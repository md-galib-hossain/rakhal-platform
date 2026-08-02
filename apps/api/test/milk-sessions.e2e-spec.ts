import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Milk page: configurable sessions, owner-locked (no ticket #, 2026-07-18).
 * `FarmModuleSettings.milkActiveSessions` (default MORNING+EVENING) already
 * existed; this adds the actual enforcement + a dedicated owner-only write
 * path: `PATCH /settings/modules/milk-sessions` (`settings.milk-sessions-manage`,
 * split out of the general Manager+Owner `settings.update` route so a Manager
 * can't unlock extra sessions on their own), plus write-time validation in
 * `MilkService.saveLog`/`submit` (previously a disabled session could still be
 * logged via the API — only the read-side `sessionConfig` reflected it).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Milk sessions — owner-only toggle + write-side enforcement (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let manager: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
  }, 30_000);

  afterAll(async () => {
    // Restore the default active sessions — shared dev-DB state other e2e
    // suites (and manual testing) rely on.
    await request(server())
      .patch(api('/settings/modules/milk-sessions'))
      .set(...auth(owner))
      .send({ active_sessions: ['morning', 'evening'] });
    await ctx.app.close();
  });

  it('a Manager cannot toggle sessions (owner-only permission)', async () => {
    await request(server())
      .patch(api('/settings/modules/milk-sessions'))
      .set(...auth(manager))
      .send({ active_sessions: ['morning', 'noon', 'evening'] })
      .expect(403);
  });

  it('rejects a payload that drops every session — at least one must stay active', async () => {
    await request(server())
      .patch(api('/settings/modules/milk-sessions'))
      .set(...auth(owner))
      .send({ active_sessions: [] })
      .expect(400);
  });

  it('an Owner can now lock morning/evening too as long as one session remains', async () => {
    await request(server())
      .patch(api('/settings/modules/milk-sessions'))
      .set(...auth(owner))
      .send({ active_sessions: ['noon'] })
      .expect(200);

    await request(server())
      .patch(api('/settings/modules/milk-sessions'))
      .set(...auth(owner))
      .send({ active_sessions: ['morning', 'evening'] })
      .expect(200);
  });

  it('an Owner can unlock NOON, and it is then reflected in the milk log sessionConfig', async () => {
    const updated = await request(server())
      .patch(api('/settings/modules/milk-sessions'))
      .set(...auth(owner))
      .send({ active_sessions: ['morning', 'evening', 'noon'] })
      .expect(200);
    expect(updated.body.data.active_sessions.sort()).toEqual([
      'evening',
      'morning',
      'noon',
    ]);

    const logTable = await request(server())
      .get(api('/milk/log'))
      .set(...auth(owner))
      .expect(200);
    expect(logTable.body.data.sessionConfig.sort()).toEqual([
      'EVENING',
      'MORNING',
      'NOON',
    ]);
  });

  it('logging to a disabled session is rejected at write time, not just hidden in the UI', async () => {
    // Lock it back down to morning+evening only.
    await request(server())
      .patch(api('/settings/modules/milk-sessions'))
      .set(...auth(owner))
      .send({ active_sessions: ['morning', 'evening'] })
      .expect(200);

    const cattle = await request(server())
      .get(api('/cattle?limit=1'))
      .set(...auth(owner))
      .expect(200);
    const cattleId = (cattle.body.data as Array<{ id: string }>)[0]?.id;
    expect(cattleId).toBeTruthy();

    const testDate = new Date(
      Date.now() +
        (1400 + Math.floor(Math.random() * 1000)) * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);

    await request(server())
      .post(api('/milk/log'))
      .set(...auth(owner))
      .send({
        date: testDate,
        session: 'NIGHT',
        entries: [{ cattleId, yieldL: 3 }],
      })
      .expect(400);

    await request(server())
      .post(api('/milk/submit'))
      .set(...auth(owner))
      .send({ date: testDate, session: 'NIGHT' })
      .expect(400);
  });
});
