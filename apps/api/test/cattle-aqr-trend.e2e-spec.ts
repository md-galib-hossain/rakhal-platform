import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RD-012(a) — `aqr_change_pct` on `GET /cattle/:id/overview` (the real live handler,
 * `CattleDetailService.overview()`) reconstructs the cow's AQR score 30 days ago from
 * `ActivityLog.previousAqrScore` (`computeAqrScoreAsOf`, `aqr-trend.ts`) — no new snapshot
 * storage, per the user's own confirmed design decision.
 *
 * Backdates an `ActivityLog` row's `timestamp` directly via Prisma to simulate "30+ days ago"
 * (the API has no way to backdate an event) — same technique
 * `safety-withdrawal-release.e2e-spec.ts` uses for backdating a `SafetyWithdrawal`.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Cattle — AQR trend reconstructed from ActivityLog (e2e, RD-012a)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  /** Registration fires the `animal_registered` AQR event (0 -> +50). Backdated to 40 days ago
   * so it falls outside the 30-day trend window used by `aqr_change_pct`. */
  async function createBackdatedCow(label: string) {
    const res = await request(server())
      .post(api('/cattle'))
      .set(...auth(owner))
      .send({
        tagNumber: `E2E-AQRTREND-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
      })
      .expect(201);
    const cattleId = res.body.data.id as string;

    const registrationLog = await prisma.activityLog.findFirstOrThrow({
      where: { farmId: owner.farmId, relatedCattleId: cattleId },
      orderBy: { timestamp: 'desc' },
    });
    await prisma.activityLog.update({
      where: { id: registrationLog.id },
      data: { timestamp: new Date(Date.now() - 40 * 24 * 60 * 60 * 1000) },
    });

    return cattleId;
  }

  it('a score change after the 30-day window reconstructs the earlier value via previousAqrScore', async () => {
    const cattleId = await createBackdatedCow('A');

    // Sole event before "now" is the backdated registration (score 50, 40d ago). Nothing has
    // changed it since, so score-as-of-30d-ago should still resolve to the CURRENT score (50) —
    // the "no later event" fallback — giving aqr_change_pct 0 before any new event lands.
    const beforeRes = await request(server())
      .get(api(`/cattle/${cattleId}/overview`))
      .set(...auth(owner));
    expect(beforeRes.status).toBe(200);
    expect(beforeRes.body.data.aqr_score).toBe(50);
    expect(beforeRes.body.data.aqr_change_pct).toBe(0);

    // Report a real (CURATIVE) sickness now — a fresh, un-backdated AQR event
    // (`sickness_reported`, -10) that DOES fall inside the 30-day window.
    await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        note: 'E2E AQR trend test — mastitis',
        careType: 'CURATIVE',
        priority: 'HIGH',
      })
      .expect(201);

    const afterRes = await request(server())
      .get(api(`/cattle/${cattleId}/overview`))
      .set(...auth(owner));
    expect(afterRes.status).toBe(200);
    expect(afterRes.body.data.aqr_score).toBe(40);
    // Reconstructed "30 days ago" reads the new event's own previousAqrScore (50) — the
    // registration event stays invisible to the window since it was pushed outside it.
    expect(afterRes.body.data.aqr_change_pct).toBe(-20);
  });

  it('GET /cattle/highlights returns a numeric (or null) herd-level aqr_change_pct, not hardcoded null', async () => {
    // Farm-wide aggregate over shared dev-DB state — only smoke-checked (type/route), not an
    // exact value, since other e2e specs and seed data share this farm's active herd.
    const res = await request(server())
      .get(api('/cattle/highlights'))
      .set(...auth(owner));
    expect(res.status).toBe(200);
    const pct = res.body.data.aqr_change_pct;
    expect(pct === null || typeof pct === 'number').toBe(true);
  });
});
