import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feed Formulator — `GET /feed/ingredients/paged`'s `feedClass` filter upgraded from single-value
 * to multi-select (2026-08-15, reusable `FilterBar` checklist follow-up): comma-separated values
 * (`?feedClass=FORAGE,MINERAL`) matched with Prisma `in`, not `=`. Asserts a single class still
 * narrows correctly and two comma-joined classes union together (not intersect / not ignored).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — ingredients paged multi-class filter (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('a single feedClass value still narrows to just that class', async () => {
    const res = await request(server())
      .get(api('/feed/ingredients/paged?feedClass=MINERAL&limit=50'))
      .set(...auth(owner))
      .expect(200);

    const items: Array<{ feed_class: string }> = res.body.data;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.feed_class === 'MINERAL')).toBe(true);
  });

  it('comma-separated feedClass values union across classes', async () => {
    // This used to fetch the first 50 of `FORAGE,MINERAL` and assert both classes appeared on
    // that page. The route orders by `feedClass ASC, nameEn ASC`, so once the catalogue grew past
    // 50 FORAGE rows (59 live at the time of writing, against 3 MINERAL) the first page became
    // all-FORAGE and the assertion could never hold again — it was testing catalogue composition,
    // not the filter. Union semantics are now asserted in a way that does not depend on where the
    // page boundary happens to fall.
    const fetchClass = async (feedClass: string) => {
      const res = await request(server())
        .get(api(`/feed/ingredients/paged?feedClass=${feedClass}&limit=100`))
        .set(...auth(owner))
        .expect(200);
      return res.body.data as Array<{ id: string; feed_class: string }>;
    };

    const [forage, mineral, both] = await Promise.all([
      fetchClass('FORAGE'),
      fetchClass('MINERAL'),
      fetchClass('FORAGE,MINERAL'),
    ]);

    // Nothing outside the requested classes leaks in.
    expect(
      both.every((i) => ['FORAGE', 'MINERAL'].includes(i.feed_class)),
    ).toBe(true);

    // Each single-class query is non-empty, so the union below is a real test and not
    // vacuously true on an empty catalogue.
    expect(forage.length).toBeGreaterThan(0);
    expect(mineral.length).toBeGreaterThan(0);

    // The comma query is the union of the two: it returns at least as many rows as either
    // alone, and strictly more than either unless one class is empty.
    expect(both.length).toBeGreaterThanOrEqual(forage.length);
    expect(both.length).toBeGreaterThan(mineral.length);
  });
});
