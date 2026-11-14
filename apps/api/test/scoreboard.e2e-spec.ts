import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Scoreboard (§18 / API §14) e2e. Proves the opt-in gate (own cattle only appear
 * after joining), the highlights + leaderboard shapes, and RBAC: view = Owner/
 * Manager (`scoreboard.read`), join/leave = Owner only (`scoreboard.join`).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Scoreboard (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;

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
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    // Clean slate so the opt-in assertion is deterministic.
    await request(server())
      .delete(api('/scoreboard/join'))
      .set(...auth(owner));
  }, 30_000);

  afterAll(async () => {
    await request(server())
      .delete(api('/scoreboard/join'))
      .set(...auth(owner));
    await ctx.app.close();
  });

  it('owner highlights show not-joined before opting in', async () => {
    const res = await request(server())
      .get(api('/scoreboard/highlights'))
      .set(...auth(owner))
      .expect(200);
    expect(res.body.data.leaderboard_joined).toBe(false);
    expect(res.body.data).toHaveProperty('avg_herd_aqr');
    expect(res.body.data).toHaveProperty('top_tier_cows_count');
  });

  it('own cattle are absent from the leaderboard until joined', async () => {
    const res = await request(server())
      .get(api('/scoreboard/leaderboard'))
      .set(...auth(owner))
      .expect(200);
    expect(
      res.body.data.entries.every((e: { is_own: boolean }) => !e.is_own),
    ).toBe(true);
  });

  it('rejects join without accepting the terms (400)', async () => {
    await request(server())
      .post(api('/scoreboard/join'))
      .set(...auth(owner))
      .send({ accept_data_visibility_terms: false })
      .expect(400);
  });

  it('owner joins and then sees own cattle flagged is_own', async () => {
    const joined = await request(server())
      .post(api('/scoreboard/join'))
      .set(...auth(owner))
      .send({ accept_data_visibility_terms: true })
      .expect(201);
    expect(joined.body.data.leaderboard_joined).toBe(true);

    const board = await request(server())
      .get(api('/scoreboard/leaderboard?scope=national&view=star_cows'))
      .set(...auth(owner))
      .expect(200);
    expect(board.body.data.entries.length).toBeGreaterThan(0);
    expect(
      board.body.data.entries.some((e: { is_own: boolean }) => e.is_own),
    ).toBe(true);
    // ranked descending by AQR
    const aqrs = board.body.data.entries.map(
      (e: { aqr_score: number }) => e.aqr_score,
    );
    expect([...aqrs].sort((a: number, b: number) => b - a)).toEqual(aqrs);
    expect(board.body.data.meta.total).toBeGreaterThan(0);

    const hl = await request(server())
      .get(api('/scoreboard/highlights'))
      .set(...auth(owner))
      .expect(200);
    expect(hl.body.data.leaderboard_joined).toBe(true);
  });

  it('serves the top_firms view', async () => {
    const res = await request(server())
      .get(api('/scoreboard/leaderboard?view=top_firms'))
      .set(...auth(owner))
      .expect(200);
    expect(res.body.data.view).toBe('top_firms');
    expect(
      res.body.data.entries.every(
        (e: { avg_aqr: number }) => typeof e.avg_aqr === 'number',
      ),
    ).toBe(true);
  });

  describe('RBAC', () => {
    it('manager may view the leaderboard', async () => {
      await request(server())
        .get(api('/scoreboard/leaderboard'))
        .set(...auth(manager))
        .expect(200);
    });

    it('manager may NOT join (owner-only)', async () => {
      await request(server())
        .post(api('/scoreboard/join'))
        .set(...auth(manager))
        .send({ accept_data_visibility_terms: true })
        .expect(403);
    });

    it('worker may NOT view (no scoreboard.read)', async () => {
      await request(server())
        .get(api('/scoreboard/highlights'))
        .set(...auth(worker))
        .expect(403);
    });

    it('rejects an unauthenticated request', async () => {
      await request(server()).get(api('/scoreboard/leaderboard')).expect(401);
    });
  });
});
