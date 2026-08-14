import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * Feed/Forage taxonomy unification — the `Forage` → `FeedItem` FK linkage to
 * `FeedIngredient` (feed is the umbrella term; forage/concentrate/mineral/
 * vitamin/additive are its classes, via `FeedClass`/`FeedSubType`). Covers:
 * (1) every `FeedItem` row has a real `ingredientId` after seed + backfill;
 * (2) the bag-unit stock-decrement regression the old name-match/kg-only
 * matching silently missed; (3) a purchased item's price change refreshes the
 * linked ingredient's effective cost (PRD §15.3, previously unimplemented);
 * (4) the new `MINERAL` feed class round-trips end to end; (5) RBAC is
 * unchanged (shared `inventory.*` permissions).
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Feed item ↔ ingredient linkage (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let prisma: PrismaService;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    prisma = ctx.app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('every FeedItem row has a non-null ingredientId (backfill proof)', async () => {
    const unlinked = await prisma.feedItem.count({
      where: { ingredientId: null },
    });
    expect(unlinked).toBe(0);
  });

  it('converts a non-kg unit through kgPerUnit when decrementing (bag-unit regression)', async () => {
    const ings = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    const ingredient = (
      ings.body.data as Array<{ id: string; effective_price_per_kg: number }>
    )[0];

    await prisma.feedItem.deleteMany({
      where: { farmId: owner.farmId, ingredientId: ingredient.id },
    });
    const feedItem = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E Bag Item ${Date.now()}`,
        feedClass: 'FORAGE',
        ingredientId: ingredient.id,
        unitId: 'unit_bag',
        kgPerUnit: 2,
        currentStock: 100,
        costPerUnit: 20,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    const feedItemId = feedItem.body.data.id as string;

    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...auth(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E Bag Regression Formula ${Date.now()}`,
        items: [{ ingredientId: ingredient.id, amountKg: 4 }],
      })
      .expect(201);

    // Previously: a non-kg-unit feed item was silently skipped by the decrement
    // (only kg-unit rows matched). Now: 4 actual kg / 2 kg-per-bag = 2 bags.
    await request(server())
      .post(api('/feed/distributions'))
      .set(...auth(owner))
      .send({ concentrationId: conc.body.data.id })
      .expect(201);

    const after = await request(server())
      .get(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .expect(200);
    expect(after.body.data.currentStock).toBe(98); // 100 − (4kg / 2kg-per-bag)

    await prisma.feedItem.deleteMany({ where: { id: feedItemId } });
  });

  it("a feed item's price change refreshes the linked ingredient's effective cost (PRD §15.3)", async () => {
    const custom = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Price Sync Ingredient ${Date.now()}`,
        pricePerKg: 8,
        dmPct: 90,
      })
      .expect(201);
    const ingredientId = custom.body.data.id as string;

    const feedItem = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E Price Sync Item ${Date.now()}`,
        feedClass: 'CONCENTRATE',
        ingredientId,
        unitId: 'unit_kg',
        currentStock: 50,
        costPerUnit: 8,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);
    const feedItemId = feedItem.body.data.id as string;

    await request(server())
      .patch(api(`/inventory/feed-items/${feedItemId}`))
      .set(...auth(owner))
      .send({ costPerUnit: 15 })
      .expect(200);

    const ings = await request(server())
      .get(api('/feed/ingredients'))
      .set(...auth(owner))
      .expect(200);
    const updated = (
      ings.body.data as Array<{
        id: string;
        effective_price_per_kg: number;
        price_source: string;
      }>
    ).find((i) => i.id === ingredientId);
    expect(updated?.effective_price_per_kg).toBe(15);
    expect(updated?.price_source).toBe('farm_override');

    await prisma.feedItem.deleteMany({ where: { id: feedItemId } });
  });

  it('round-trips the new MINERAL feed class end to end', async () => {
    const feedItem = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E Mineral Item ${Date.now()}`,
        feedClass: 'MINERAL',
        feedSubType: 'PREMIX',
        ingredientId: (
          await request(server())
            .post(api('/feed/ingredients/custom'))
            .set(...auth(owner))
            .send({
              name: `E2E Mineral Ingredient ${Date.now()}`,
              pricePerKg: 60,
            })
            .expect(201)
        ).body.data.id,
        unitId: 'unit_bag',
        kgPerUnit: 5,
        currentStock: 10,
        costPerUnit: 400,
        purchaseDate: new Date().toISOString(),
      })
      .expect(201);

    expect(feedItem.body.data.feedClass).toBe('MINERAL');
    expect(feedItem.body.data.feedSubType).toBe('PREMIX');

    const list = await request(server())
      .get(api('/inventory/feed-items?feedClass=MINERAL'))
      .set(...auth(owner))
      .expect(200);
    expect(
      (list.body.data as Array<{ id: string }>).some(
        (i) => i.id === feedItem.body.data.id,
      ),
    ).toBe(true);

    await prisma.feedItem.deleteMany({ where: { id: feedItem.body.data.id } });
  });

  describe('RBAC (unchanged — shared inventory.* permissions)', () => {
    it('403s a worker creating a feed item (inventory.create is manager+)', async () => {
      await request(server())
        .post(api('/inventory/feed-items'))
        .set(...auth(worker))
        .send({
          name: 'Worker Attempt',
          feedClass: 'FORAGE',
          ingredientId: 'does-not-matter',
          unitId: 'unit_kg',
          currentStock: 1,
          costPerUnit: 1,
          purchaseDate: new Date().toISOString(),
        })
        .expect(403);
    });

    it('200s a worker reading feed items (inventory.read is worker-ok)', async () => {
      await request(server())
        .get(api('/inventory/feed-items'))
        .set(...auth(worker))
        .expect(200);
    });
  });
});
