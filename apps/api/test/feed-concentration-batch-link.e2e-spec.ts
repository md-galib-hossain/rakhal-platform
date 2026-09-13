import request from 'supertest';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-422 (docs/EPIC_PREPARED_FEED.md §5): a `FeedConcentrationItem` line can optionally link a
 * real inventory batch it will consume on finalize (RAKHAL-423 wires the actual deduction — this
 * ticket is validation + persistence only). Covers: at most one of `feedItemId`/`feedStockId`; the
 * referenced batch must be farm-owned and not soft-deleted; its own ingredient must match the
 * line's `ingredientId`; `create()` and `update()` both persist the link; `GET` round-trips it.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed Formulator — concentration item batch link (e2e, RAKHAL-422)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let ingredientA: string;
  let ingredientB: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createIngredient = async (name: string) => {
    const res = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `${name} ${Date.now()}-${Math.random()}`,
        nutrientGroup: 'ENERGY',
        pricePerKg: 10,
        dmPct: 90,
        cpPct: 10,
        meMjPerKgDm: 9,
      })
      .expect(201);
    return res.body.data.id as string;
  };

  const createFeedItem = async (ingredientId: string, stock = 100) => {
    const res = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E Batch-Link Feed Item ${Date.now()}-${Math.random()}`,
        feedClass: 'FORAGE',
        ingredientId,
        unitId: 'unit_kg',
        currentStock: stock,
        costPerUnit: 15,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    return res.body.data.id as string;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    ingredientA = await createIngredient('E2E Batch-Link Ingredient A');
    ingredientB = await createIngredient('E2E Batch-Link Ingredient B');
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('links a purchased FeedItem batch and round-trips it', async () => {
    const feedItemId = await createFeedItem(ingredientA);

    const created = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Linked Template ${Date.now()}`,
        items: [{ ingredientId: ingredientA, amountKg: 5, feedItemId }],
      })
      .expect(201);
    expect(created.body.data.ingredients[0].feed_item_id).toBe(feedItemId);
    expect(created.body.data.ingredients[0].feed_stock_id).toBeNull();

    const fetched = await request(server())
      .get(api(`/feed/concentrations/${created.body.data.id}`))
      .set(...auth(owner))
      .expect(200);
    expect(fetched.body.data.ingredients[0].feed_item_id).toBe(feedItemId);
  });

  it('rejects a feedItemId whose own ingredient does not match the line', async () => {
    const feedItemForB = await createFeedItem(ingredientB);

    await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Mismatched Link Template ${Date.now()}`,
        items: [
          {
            ingredientId: ingredientA,
            amountKg: 5,
            feedItemId: feedItemForB,
          },
        ],
      })
      .expect(400);
  });

  it('rejects a feedItemId that does not exist or is not farm-owned', async () => {
    await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Unknown Link Template ${Date.now()}`,
        items: [
          {
            ingredientId: ingredientA,
            amountKg: 5,
            feedItemId: 'cl-does-not-exist',
          },
        ],
      })
      .expect(400);
  });

  it('rejects a line linking both a feedItemId and a feedStockId', async () => {
    const feedItemId = await createFeedItem(ingredientA);

    await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Dual-Link Template ${Date.now()}`,
        items: [
          {
            ingredientId: ingredientA,
            amountKg: 5,
            feedItemId,
            feedStockId: 'cl-also-set',
          },
        ],
      })
      .expect(400);
  });

  it('links a prepared FeedStock batch whose promoted ingredient matches, rejects a mismatch, and update() persists it', async () => {
    const template = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Source Template ${Date.now()}`,
        items: [{ ingredientId: ingredientA, amountKg: 10 }],
      })
      .expect(201);

    const finalized = await request(server())
      .post(api(`/feed/concentrations/${template.body.data.id}/finalize`))
      .set(...auth(owner))
      .expect(201);
    const promotedIngredientId = finalized.body.data.ingredient.id as string;
    const stockId = finalized.body.data.stock.id as string;

    // Mismatch: the stock's promoted ingredient is `promotedIngredientId`, not `ingredientB`.
    await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Mismatched Stock-Link Template ${Date.now()}`,
        items: [
          { ingredientId: ingredientB, amountKg: 3, feedStockId: stockId },
        ],
      })
      .expect(400);

    // Correct link, created with no link then updated to add one — proves both create() and
    // update() persist it, and that update() (wholesale line replacement) carries it through.
    const consumer = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Stock-Link Consumer ${Date.now()}`,
        items: [{ ingredientId: promotedIngredientId, amountKg: 3 }],
      })
      .expect(201);
    expect(consumer.body.data.ingredients[0].feed_stock_id).toBeNull();

    const updated = await request(server())
      .patch(api(`/feed/concentrations/${consumer.body.data.id}`))
      .set(...auth(owner))
      .send({
        items: [
          {
            ingredientId: promotedIngredientId,
            amountKg: 3,
            feedStockId: stockId,
          },
        ],
      })
      .expect(200);
    expect(updated.body.data.ingredients[0].feed_stock_id).toBe(stockId);
  });
});
