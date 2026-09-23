import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feed Distribution (§12.5) e2e. Builds a concentration from seeded ingredients,
 * logs distributions (planned-default + actual/refusal overrides), and asserts
 * cost-from-actual, list/detail, validation, and RBAC (worker may LOG via
 * `feed.distribution-log` but cannot READ — has no `feed.read`).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Distribution (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let prisma: PrismaService;

  let ingredientA: { id: string; price: number; name: string };
  let ingredientB: { id: string; price: number };
  let concentrationId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const round2 = (n: number) => Math.round(n * 100) / 100;

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    prisma = ctx.app.get(PrismaService);

    const ings = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    const list = ings.body.data as Array<{
      id: string;
      name_en: string;
      effective_price_per_kg: number;
    }>;
    expect(list.length).toBeGreaterThanOrEqual(2);
    ingredientA = {
      id: list[0].id,
      price: list[0].effective_price_per_kg,
      name: list[0].name_en,
    };
    ingredientB = { id: list[1].id, price: list[1].effective_price_per_kg };

    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Distribution Formula ${Date.now()}`,
        items: [
          { ingredientId: ingredientA.id, amountKg: 4 },
          { ingredientId: ingredientB.id, amountKg: 2 },
        ],
      })
      .expect(201);
    concentrationId = conc.body.data.id as string;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('logs a distribution defaulting actual = planned, cost from actual', async () => {
    const res = await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({ concentrationId, distributedAt: '2026-06-15' })
      .expect(201);

    const d = res.body.data;
    expect(d.total_planned_kg).toBe(6);
    expect(d.total_actual_kg).toBe(6);
    const expectedCost = round2(4 * ingredientA.price + 2 * ingredientB.price);
    expect(d.total_actual_cost).toBe(expectedCost);
    expect(d.items).toHaveLength(2);
  });

  it('logs actual/refusal overrides and reflects them in cost', async () => {
    const res = await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({
        concentrationId,
        items: [
          { ingredientId: ingredientA.id, actualKg: 5, refusalKg: 1 },
          // ingredientB omitted → falls back to planned 2kg
        ],
      })
      .expect(201);

    const d = res.body.data;
    expect(d.total_actual_kg).toBe(7); // 5 + 2
    expect(d.total_refusal_kg).toBe(1);
    expect(d.total_actual_cost).toBe(
      round2(5 * ingredientA.price + 2 * ingredientB.price),
    );
  });

  it('lists and fetches distributions for the farm', async () => {
    const list = await request(server())
      .get(api('/feed/distributions'))
      .set(...auth(owner))
      .expect(200);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.length).toBeGreaterThanOrEqual(2);
    expect(list.body.meta).toHaveProperty('hasNextPage');

    const id = list.body.data[0].id as string;
    const detail = await request(server())
      .get(api(`/feed/distributions/${id}`))
      .set(...auth(owner))
      .expect(200);
    expect(detail.body.data.id).toBe(id);
    expect(Array.isArray(detail.body.data.items)).toBe(true);
  });

  it('serves a feed-efficiency summary', async () => {
    // The concentration has no group, but the endpoint requires a real group;
    // create a throwaway group to assert the shape resolves (zero distributions).
    const grp = await request(server())
      .post(api('/settings/feed-groups'))
      .set(...auth(owner))
      .send({ name: `E2E Eff Group ${Date.now()}` })
      .expect(201);
    const groupId = grp.body.data.id as string;

    const res = await request(server())
      .get(api(`/feed/efficiency?feedGroupId=${groupId}&month=2026-06`))
      .set(...auth(owner))
      .expect(200);
    expect(res.body.data).toMatchObject({
      feed_group_id: groupId,
      period: '2026-06',
      distributions: 0,
    });
    expect(res.body.data).toHaveProperty('feed_cost_per_litre');
  });

  it('decrements a matching feed item on log via its ingredientId FK (§15.3)', async () => {
    // Hermetic: remove any same-ingredient feed item left by a prior run so the
    // FK match is unambiguous.
    await prisma.feedItem.deleteMany({
      where: { farmId: owner.farmId, ingredientId: ingredientA.id },
    });

    // A feed item linked to ingredient A, in kg, is the match target.
    const feedItem = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: ingredientA.name,
        feedClass: 'FORAGE',
        ingredientId: ingredientA.id,
        unitId: 'unit_kg',
        currentStock: 100,
        costPerUnit: 10,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    const feedItemId = feedItem.body.data.id as string;

    // Default-planned distribution → ingredient A actual = 4 kg.
    const dist = await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({ concentrationId })
      .expect(201);
    expect(dist.body.data.forage_decrements).toBeGreaterThanOrEqual(1);

    const after = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    expect(after.body.data.currentStock).toBe(96); // 100 − 4

    await prisma.feedItem.deleteMany({ where: { id: feedItemId } });
  });

  describe('validation + RBAC', () => {
    it('404s an unknown concentration', async () => {
      await request(server())
        .post(api('/feed/distributions'))
        .set(...auth(owner))
        .send({ concentrationId: 'does-not-exist' })
        .expect(404);
    });

    it('404s an ingredient that does not exist in the catalogue at all', async () => {
      await request(server())
        .post(api('/feed/distributions'))
        .set(...auth(owner))
        .send({
          concentrationId,
          items: [{ ingredientId: 'not-a-real-ingredient', actualKg: 1 }],
        })
        .expect(404);
    });

    // User request 2026-09-23: "Feed Today" must not be limited to whatever's baked into the
    // target recipe — a real catalogue ingredient outside the formula is now accepted as a new
    // EXTRA line (plannedKg 0), not rejected. Superseded the old "400s an ingredient not in the
    // concentration" test, which asserted the opposite of this now-intended behavior.
    it('adds a real ingredient outside the formula as a new extra line', async () => {
      const ings = await request(server())
        .get(api('/feed/ingredients'))
        .set(...auth(owner))
        .expect(200);
      const list = ings.body.data as Array<{
        id: string;
        effective_price_per_kg: number;
      }>;
      const extra = list.find(
        (i) => i.id !== ingredientA.id && i.id !== ingredientB.id,
      )!;
      expect(extra).toBeDefined();

      const res = await request(server())
        .post(api('/feed/distributions'))
        .set(...auth(owner))
        .send({
          concentrationId,
          items: [{ ingredientId: extra.id, actualKg: 3 }],
        })
        .expect(201);

      const d = res.body.data;
      const extraLine = d.items.find(
        (i: { ingredient_id: string }) => i.ingredient_id === extra.id,
      );
      expect(extraLine).toBeDefined();
      expect(extraLine.planned_kg).toBe(0);
      expect(extraLine.actual_kg).toBe(3);
      expect(d.items).toHaveLength(3);
    });

    it('400s a farmId in the body (forbidNonWhitelisted)', async () => {
      await request(server())
        .post(api('/feed/distributions'))
        .set(...auth(owner))
        .send({ concentrationId, farmId: 'x' })
        .expect(400);
    });

    it('lets a worker LOG a distribution (feed.distribution-log)', async () => {
      await request(server())
        .post(api('/feed/distributions'))
        .set(...auth(worker))
        .send({ concentrationId })
        .expect(201);
    });

    it('lets a worker READ distributions (feed.read, RAKHAL-427)', async () => {
      await request(server())
        .get(api('/feed/distributions'))
        .set(...auth(worker))
        .expect(200);
    });
  });
});

/**
 * Stock enforcement (user request 2026-08-14 — "we shouldnt able to feed anything which is not in
 * inventory because feed item will be come from inventory"). Previously both
 * `planForageDecrements()` (the `FeedItem.ingredientId`-match path every "Feed Today" call uses)
 * and `quickFeed()` silently floored the resulting stock at 0 instead of rejecting an
 * over-consuming log — a farm could feed more of an ingredient than it actually had in Inventory.
 * Both now throw 400 and leave stock untouched, matching `assertSufficientStock`'s existing
 * behavior for the `stockId`-lot path (`feed-distribution-stock.e2e-spec.ts`).
 */
describe('Feed Distribution — stock enforcement (e2e)', () => {
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

  async function createIngredientAndFeedItem(currentStock: number) {
    const ingredient = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Stock-Enforce Ingredient ${Date.now()}-${Math.random()}`,
        pricePerKg: 10,
      })
      .expect(201);
    const ingredientId = ingredient.body.data.id as string;

    const feedItem = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E Stock-Enforce Feed Item ${Date.now()}`,
        feedClass: 'CONCENTRATE',
        ingredientId,
        unitId: 'unit_kg',
        currentStock,
        costPerUnit: 10,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    const feedItemId = feedItem.body.data.id as string;

    return { ingredientId, feedItemId };
  }

  it('blocks "Feed Today" (concentration-based) logging more than the matching FeedItem has in stock', async () => {
    const { ingredientId, feedItemId } = await createIngredientAndFeedItem(5);

    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Stock-Enforce Formula ${Date.now()}`,
        items: [{ ingredientId, amountKg: 5 }],
      })
      .expect(201);

    await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({
        concentrationId: conc.body.data.id,
        items: [{ ingredientId, actualKg: 999 }],
      })
      .expect(400);

    const item = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    expect(item.body.data.currentStock).toBe(5); // untouched
  });

  it('allows logging exactly what is in stock', async () => {
    const { ingredientId, feedItemId } = await createIngredientAndFeedItem(5);

    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Stock-Enforce Exact Formula ${Date.now()}`,
        items: [{ ingredientId, amountKg: 5 }],
      })
      .expect(201);

    await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({
        concentrationId: conc.body.data.id,
        items: [{ ingredientId, actualKg: 5 }],
      })
      .expect(201);

    const item = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    expect(item.body.data.currentStock).toBe(0);
  });

  it('blocks a Feeding Grid confirm logging more than the FeedItem has in stock', async () => {
    const { feedItemId } = await createIngredientAndFeedItem(3);
    const cow = await request(server())
      .get(api('/cattle?limit=1'))
      .set(...auth(owner))
      .expect(200);
    const cattleId = cow.body.data[0].id as string;

    await request(server())
      .post(api('/feed/grid/confirm'))
      .set(...auth(owner))
      .send({
        date: '2026-06-20',
        sourceType: 'FEED_ITEM',
        feedItemId,
        entries: [{ cattleId, offeredKg: 10 }],
      })
      .expect(400);

    const item = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    expect(item.body.data.currentStock).toBe(3); // untouched
  });
});
