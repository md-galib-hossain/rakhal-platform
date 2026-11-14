import request from 'supertest';
import { localDateIso } from '../src/common/farm-time/farm-time';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Farm.timezone — "today" is the farm's local day, not the UTC day. Requires the dev stack up + `pnpm seed`.
 * The calendar endpoints are the observable seam: they mark every day after "today" as `future`, so moving the
 * farm's timezone moves the `future` boundary. Restores the demo farm to Asia/Dhaka afterwards.
 */
describe('Farm timezone drives "today" (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const setTimezone = (timezone: string) =>
    request(server())
      .patch(api('/settings/farm'))
      .set(...auth(owner))
      .send({ timezone });

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await setTimezone('Asia/Dhaka');
    await ctx.app.close();
  });

  it('GET /settings/farm exposes the timezone (default Asia/Dhaka)', async () => {
    const res = await request(server())
      .get(api('/settings/farm'))
      .set(...auth(owner))
      .expect(200);
    expect(res.body.data.timezone).toBe('Asia/Dhaka');
  });

  it('rejects a timezone that is not an IANA name', async () => {
    await setTimezone('Mars/Olympus_Mons').expect(400);
  });

  for (const route of ['/milk/log/calendar', '/feed/grid/calendar']) {
    it(`${route} marks days after the FARM's today as future, for the farm's own zone`, async () => {
      // 26 hours apart, so "today" differs between these two zones at every instant.
      for (const timezone of ['Pacific/Kiritimati', 'Etc/GMT+12']) {
        await setTimezone(timezone).expect(200);

        const today = localDateIso(timezone);
        const res = await request(server())
          .get(api(`${route}?month=${today.slice(0, 7)}`))
          .set(...auth(owner))
          .expect(200);

        const days = res.body.data.days as Array<{
          date: string;
          status: string;
        }>;
        const byDate = new Map(days.map((d) => [d.date, d.status]));
        expect(byDate.get(today)).not.toBe('future');

        const tomorrow = new Date(`${today}T00:00:00Z`);
        tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
        const tomorrowIso = tomorrow.toISOString().slice(0, 10);
        if (byDate.has(tomorrowIso)) {
          expect(byDate.get(tomorrowIso)).toBe('future');
        }
      }
    });
  }
});
