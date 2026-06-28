import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Representative e2e suite — the automated replacement for the manual login →
 * curl → eyeball "live smoke" the DoD used to require. Proves, in seconds and
 * repeatably: the bootstrap + envelope, owner/manager/worker RBAC on the Settings
 * + Finance routes, request validation, and that the seeded finance data makes
 * `survivalRunway` computable (the case manual smoke could never demonstrate).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Settings + Finance (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  describe('bootstrap', () => {
    it('GET /health is served un-prefixed', async () => {
      await request(server()).get('/health').expect(200);
    });

    it('rejects an unauthenticated request', async () => {
      await request(server()).get(api('/settings/farm')).expect(401);
    });

    it('404s an unknown route with the error envelope', async () => {
      const res = await request(server()).get(api('/nope/nope')).expect(404);
      expect(res.body).toMatchObject({ success: false });
    });
  });

  describe('RBAC', () => {
    it('owner reads farm settings (success envelope)', async () => {
      const res = await request(server())
        .get(api('/settings/farm'))
        .set(...auth(owner))
        .expect(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.farm_name).toEqual(expect.any(String));
    });

    it('manager (settings.read) reads farm settings', async () => {
      await request(server())
        .get(api('/settings/farm'))
        .set(...auth(manager))
        .expect(200);
    });

    it('worker is forbidden from team + module settings (FORBIDDEN)', async () => {
      const team = await request(server())
        .get(api('/settings/team'))
        .set(...auth(worker))
        .expect(403);
      expect(team.body.code).toBe('FORBIDDEN');

      await request(server())
        .get(api('/settings/modules'))
        .set(...auth(worker))
        .expect(403);
    });

    it('worker is forbidden from inviting a member (owner-only)', async () => {
      await request(server())
        .post(api('/settings/team/invite'))
        .set(...auth(worker))
        .send({ phone: '01711111111', role: 'Worker' })
        .expect(403);
    });
  });

  describe('validation', () => {
    it('rejects an invalid invite phone with 400', async () => {
      const res = await request(server())
        .post(api('/settings/team/invite'))
        .set(...auth(owner))
        .send({ phone: '123', role: 'Worker' })
        .expect(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('finance KPIs (seed-backed)', () => {
    it('owner GET /finance/assets returns an allocation breakdown', async () => {
      const res = await request(server())
        .get(api('/finance/assets'))
        .set(...auth(owner))
        .expect(200);
      expect(Array.isArray(res.body.data.allocation)).toBe(true);
    });

    it('survivalRunway is computable from the seeded wallet + expenses', async () => {
      const res = await request(server())
        .get(api('/finance/highlights'))
        .set(...auth(owner))
        .expect(200);
      expect(res.body.data.availableLiquidity).toBeGreaterThan(0);
      expect(typeof res.body.data.survivalRunwayDays).toBe('number');
      expect(['healthy', 'warning', 'critical']).toContain(
        res.body.data.survivalRunwayStatus,
      );
    });

    // Regression guard for RD-017: voiding a transaction must net to zero in money
    // KPIs (the reversal row must not be double-counted as a negative expense).
    it('a voided expense nets to zero in the financial snapshot', async () => {
      const snapshotExpense = async (): Promise<number> => {
        const res = await request(server())
          .get(api('/dashboard/financial-snapshot'))
          .set(...auth(owner))
          .expect(200);
        return res.body.data.expenses.current as number;
      };

      const before = await snapshotExpense();

      const rec = await request(server())
        .post(api('/finance/transactions'))
        .set(...auth(owner))
        .send({
          type: 'OPERATING_EXPENSE',
          category: 'OVERHEAD',
          subType: 'salary',
          amount: 9999,
          paymentType: 'FULL',
          paymentMethod: 'CASH',
          notes: 'e2e RD-017 void-nets-to-zero',
        })
        .expect(201);
      const txId = rec.body.data.transactionId as string;

      expect(await snapshotExpense()).toBeCloseTo(before + 9999, 1);

      await request(server())
        .post(api(`/finance/transactions/${txId}/void`))
        .set(...auth(owner))
        .send({ reasonCategory: 'data_entry_error' })
        .expect(201);

      expect(await snapshotExpense()).toBeCloseTo(before, 1);
    });
  });

  // RD-016: editing module settings must change actual behaviour. Each test
  // captures the current value and restores it so the suite stays idempotent.
  describe('module settings drive behaviour (RD-016)', () => {
    const getModules = async () =>
      (
        await request(server())
          .get(api('/settings/modules'))
          .set(...auth(owner))
          .expect(200)
      ).body.data;

    const patchModules = (body: unknown) =>
      request(server())
        .patch(api('/settings/modules'))
        .set(...auth(owner))
        .send(body)
        .expect(200);

    it('dashboard herd-health threshold reflects the health setting', async () => {
      const original = (await getModules()).health
        .herd_health_score_warning_pct as number;
      const probe = original === 75 ? 80 : 75;
      try {
        await patchModules({
          health: { herd_health_score_warning_pct: probe },
        });
        const kpis = (
          await request(server())
            .get(api('/dashboard/kpis'))
            .set(...auth(owner))
            .expect(200)
        ).body.data;
        expect(kpis.herdHealth.threshold).toBe(probe);
      } finally {
        await patchModules({
          health: { herd_health_score_warning_pct: original },
        });
      }
    });

    it('milk session status reflects the active_sessions setting', async () => {
      const original = (await getModules()).milk.active_sessions as string[];
      try {
        await patchModules({ milk: { active_sessions: ['morning'] } });
        const overview = (
          await request(server())
            .get(api('/milk/overview'))
            .set(...auth(owner))
            .expect(200)
        ).body.data;
        expect(overview.sessionsStatus.evening).toBe('not_configured');
        expect(['pending', 'submitted']).toContain(
          overview.sessionsStatus.morning,
        );
      } finally {
        await patchModules({ milk: { active_sessions: original } });
      }
    });
  });
});
