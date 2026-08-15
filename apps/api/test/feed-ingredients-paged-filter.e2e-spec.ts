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
    const res = await request(server())
      .get(api('/feed/ingredients/paged?feedClass=FORAGE,MINERAL&limit=50'))
      .set(...auth(owner))
      .expect(200);

    const items: Array<{ feed_class: string }> = res.body.data;
    const classes = new Set(items.map((i) => i.feed_class));
    expect(
      items.every((i) => ['FORAGE', 'MINERAL'].includes(i.feed_class)),
    ).toBe(true);
    expect(classes.has('FORAGE')).toBe(true);
    expect(classes.has('MINERAL')).toBe(true);
  });
});
