import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Listing rations must not scale its database round-trips with the number of rations (RD-079).
 *
 * `FeedConcentrationService.enrich()` runs once per row and used to call `effectiveMap()` itself,
 * which is two queries — `feedIngredient.findMany` + `feedIngredientOverride.findMany`. Listing N
 * rations therefore cost 2N round-trips just to price ingredients, on top of everything else.
 *
 * Counting is done by spying on those two Prisma calls rather than on an aggregate database
 * counter. An earlier attempt used `pg_stat_database.xact_commit` and returned 2421/4496/8796
 * across three identical requests — the dev database is shared, so an aggregate cannot attribute
 * queries to one endpoint. Spies measure exactly the calls this endpoint makes and nothing else.
 *
 * The headline assertion is "constant regardless of N" rather than a fixed number, so it keeps
 * its meaning if the implementation legitimately changes how many lookups it needs.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — list query count (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  const ingredientIds: string[] = [];

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createdConcentrationIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');

    // Three distinct ingredients so the rations do not all share one id — a union that
    // collapses to a single id would hide a per-row lookup.
    for (let i = 0; i < 3; i++) {
      const res = await request(server())
        .post(api('/feed/ingredients/custom'))
        .set(...auth(owner))
        .send({
          name: `E2E QueryCount Ingredient ${Date.now()}-${i}`,
          nutrientGroup: 'ENERGY',
          pricePerKg: 8 + i,
          dmPct: 90,
          cpPct: 10,
          meMjPerKgDm: 9,
        })
        .expect(201);
      ingredientIds.push(res.body.data.id as string);
    }
  }, 60_000);

  afterAll(async () => {
    await prisma.feedConcentration.deleteMany({
      where: { id: { in: createdConcentrationIds } },
    });
    await ctx.app.close();
  });

  async function createRation(ingredientId: string) {
    const res = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'FEED_MIXTURE',
        name: `E2E QueryCount Ration ${Date.now()}-${Math.random()}`,
        targetType: 'HERD',
        durationDays: 30,
        targetWeightKg: 450,
        targetMilkL: 12,
        items: [{ ingredientId, amountKg: 5 }],
      })
      .expect(201);
    createdConcentrationIds.push(res.body.data.id as string);
  }

  /** Ingredient-pricing lookups made while running `fn`. */
  async function pricingQueries(fn: () => Promise<unknown>): Promise<number> {
    const ing = jest.spyOn(prisma.feedIngredient, 'findMany');
    const ovr = jest.spyOn(prisma.feedIngredientOverride, 'findMany');
    try {
      await fn();
      return ing.mock.calls.length + ovr.mock.calls.length;
    } finally {
      ing.mockRestore();
      ovr.mockRestore();
    }
  }

  const listRations = () =>
    request(server())
      .get(api('/feed/concentrations'))
      .set(...auth(owner))
      .query({ kind: 'FEED_MIXTURE' })
      .expect(200);

  it('does not add ingredient-pricing queries as rations are added', async () => {
    await createRation(ingredientIds[0]);
    const withFew = await pricingQueries(listRations);

    // Six more rations across three different ingredients.
    for (let i = 0; i < 6; i++) {
      await createRation(ingredientIds[i % ingredientIds.length]);
    }
    const withMore = await pricingQueries(listRations);

    // Before RD-079 this grew by 12 (two lookups per new ration). It must now be flat.
    expect(withMore).toBe(withFew);
  });

  it('prices a whole page with a bounded number of lookups', async () => {
    const count = await pricingQueries(listRations);

    // Two lookups — ingredients and their farm overrides — for the entire page, however many
    // rations it holds. Asserted as a small bound rather than exactly 2 so a legitimate extra
    // lookup elsewhere in the path does not fail this for the wrong reason.
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(4);
  });

  it('still returns a correctly priced ration after the batching change', async () => {
    const res = await listRations();
    const mine = (
      res.body.data as Array<{
        name: string;
        totals: { total_cost_tk: number };
      }>
    ).filter((r) => r.name.startsWith('E2E QueryCount Ration'));

    expect(mine.length).toBeGreaterThan(0);
    // 5 kg at 8-10 tk/kg — a zero here would mean the hoisted map lost its entries.
    expect(mine.every((r) => r.totals.total_cost_tk > 0)).toBe(true);
  });
});
