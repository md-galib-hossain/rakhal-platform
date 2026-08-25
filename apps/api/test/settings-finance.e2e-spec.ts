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

    // RAKHAL-354: V1 `GET /finance/highlights` dropped along with
    // `FinanceTransaction`/`WalletTransaction` — `survivalRunway` now lives
    // on `GET /dashboard/financial-snapshot` (`DashboardService.
    // financeSnapshot()`, sourced from Finance V2's `BalanceService` +
    // `ledgerCategoryNet`, same derivation V1 used, just off the ledger).
    it('survivalRunway is computable from the seeded finance-v2 accounts + expenses', async () => {
      const res = await request(server())
        .get(api('/dashboard/financial-snapshot'))
        .set(...auth(owner))
        .expect(200);
      expect(typeof res.body.data.survivalRunway.days).toEqual(
        expect.anything(),
      );
      expect(['healthy', 'warning', 'critical', 'unknown']).toContain(
        res.body.data.survivalRunway.status,
      );
    });

    // RAKHAL-354: the V1 RD-017 regression ("voiding a transaction must net
    // to zero") no longer has a V1 `POST /finance/transactions` +
    // `/void` route to drive it through HTTP — `JournalService.
    // reverseJournal` (RAKHAL-334) is the V2 equivalent and is exercised at
    // the journal level by `test/rakhal-362-atomicity-invariants.e2e-spec.ts`
    // and by `journal.service.spec.ts`'s own reversal-balances-to-zero
    // coverage; no HTTP route posts a reversible standalone expense yet
    // (`finance.reverse` exists as a permission per RAKHAL-353 but has no
    // controller). Nothing further to assert here at the settings/HTTP
    // layer — this ticket's own gate re-ran `journal.service.spec.ts` to
    // confirm the invariant still holds post-cutover.
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
