import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-434 — missed-entry calendar endpoints backing the Milk Log + Feed Grid date pickers.
 * Structural assertions only (day count, status enum, `before_farm` far in the past, `future` far
 * ahead) rather than exact per-day statuses — the demo farm's actual complete/partial/missing mix
 * drifts as other seed/e2e runs touch the shared dev DB, so pinning to today's real values would
 * make this suite flaky. Requires the dev stack up + `pnpm seed`.
 */
describe('Missed-entry calendar: GET /milk/log/calendar + GET /feed/grid/calendar (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const STATUSES = ['complete', 'partial', 'missing', 'future', 'before_farm'];
  const daysInMonth = (year: number, month: number): number =>
    new Date(Date.UTC(year, month, 0)).getUTCDate();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  for (const [route, month] of [
    ['/milk/log/calendar', '2026-09'],
    ['/feed/grid/calendar', '2026-09'],
  ] as const) {
    it(`${route} returns one status per day of the month, all valid`, async () => {
      const res = await request(server())
        .get(api(`${route}?month=${month}`))
        .set(...auth(owner))
        .expect(200);

      expect(res.body.data.month).toBe(month);
      const days = res.body.data.days as Array<{
        date: string;
        status: string;
      }>;
      expect(days).toHaveLength(daysInMonth(2026, 9));
      for (const day of days) {
        expect(STATUSES).toContain(day.status);
        expect(day.date.slice(0, 7)).toBe(month);
      }
    });

    it(`${route} marks a month long before the farm existed as before_farm throughout`, async () => {
      const res = await request(server())
        .get(api(`${route}?month=2020-01`))
        .set(...auth(owner))
        .expect(200);

      const days = res.body.data.days as Array<{ status: string }>;
      expect(days.every((d) => d.status === 'before_farm')).toBe(true);
    });

    it(`${route} marks a month far in the future as future throughout`, async () => {
      const res = await request(server())
        .get(api(`${route}?month=2099-01`))
        .set(...auth(owner))
        .expect(200);

      const days = res.body.data.days as Array<{ status: string }>;
      expect(days.every((d) => d.status === 'future')).toBe(true);
    });

    it(`${route} rejects a malformed month`, async () => {
      await request(server())
        .get(api(`${route}?month=2026-9`))
        .set(...auth(owner))
        .expect(400);
    });

    it(`${route} requires authentication`, async () => {
      await request(server())
        .get(api(`${route}?month=2026-09`))
        .expect(401);
    });
  }
});
