import request from 'supertest';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { FeedItemService } from 'src/modules/inventory/application/services/feed-item.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-444 (MILESTONE 26) — purchased feed as product + lots: manual nutrition without an
 * ingredient, restock as a new batch, FIFO consumption, nutrition edit/revert/RBAC, recall lookup and
 * the additive-rollout `reconcile()` against a legacy-column change. Requires the dev stack up +
 * `pnpm seed` + the RAKHAL-442 migration.
 */
describe('Feed item batches + nutrition (e2e)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let prisma: PrismaService;
  let feedItems: FeedItemService;
  let ownerUserId: string;

  const startedAt = new Date();
  const createdItemIds: string[] = [];

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const hay = (cpPct = 9) => ({
    dmPct: 88,
    cpPct,
    meMjPerKgDm: 8.5,
    ndfPct: 65,
    adfPct: 40,
  });

  async function createManual(
    over: Record<string, unknown> = {},
    nutrition: Record<string, unknown> = hay(),
  ) {
    const res = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E Batch Hay ${Date.now()}-${Math.random()}`,
        feedClass: 'FORAGE',
        feedSubType: 'HAY',
        unitId: 'unit_kg',
        currentStock: 10,
        costPerUnit: 5,
        purchaseDate: '2026-01-10T00:00:00.000Z',
        batchCode: 'LOT-A',
        nutrition,
        ...over,
      });
    if (res.status === 201) createdItemIds.push(res.body.data.id as string);
    return res;
  }

  async function restock(
    id: string,
    body: Record<string, unknown>,
  ): Promise<request.Response> {
    return request(server())
      .post(api(`/inventory/feed-items/${id}/batches`))
      .set(...auth(owner))
      .send(body);
  }

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    prisma = ctx.app.get(PrismaService);
    feedItems = ctx.app.get(FeedItemService);
    ownerUserId = (
      await prisma.user.findUniqueOrThrow({
        where: { email: 'owner@demo.rakhal.test' },
      })
    ).id;
  }, 30_000);

  afterAll(async () => {
    await prisma.feedItemStockMovement.deleteMany({
      where: { feedItemId: { in: createdItemIds } },
    });
    await prisma.feedItemBatch.deleteMany({
      where: { feedItemId: { in: createdItemIds } },
    });
    await prisma.feedItem.deleteMany({ where: { id: { in: createdItemIds } } });
    // Only profiles this run created that nothing references any more.
    await prisma.nutritionProfile.updateMany({
      where: { farmId: owner.farmId, createdAt: { gte: startedAt } },
      data: { supersedesId: null },
    });
    await prisma.nutritionProfile.deleteMany({
      where: {
        farmId: owner.farmId,
        createdAt: { gte: startedAt },
        batches: { none: {} },
        itemDefaults: { none: {} },
      },
    });
    await ctx.app.close();
  });

  it('creates an item with typed nutrition and NO linked ingredient', async () => {
    const res = await createManual();
    expect(res.status).toBe(201);
    const item = res.body.data;
    expect(item.ingredientId).toBeNull();
    expect(item.batches).toHaveLength(1);
    expect(item.batches[0].batchCode).toBe('LOT-A');
    expect(item.nutrition.cpPct).toBe(9);
    expect(item.nutrition.fatPct).toBeNull(); // unmeasured stays null
    expect(item.nutrition.moisturePct).toBe(12); // derived: 100 - DM
    expect(item.currentStock).toBe(10);
  });

  it('rejects an item with neither nutrition nor an ingredient, and out-of-range profiles', async () => {
    const none = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...auth(owner))
      .send({
        name: `E2E No Nutrition ${Date.now()}`,
        feedClass: 'FORAGE',
        unitId: 'unit_kg',
        currentStock: 1,
        costPerUnit: 1,
        purchaseDate: '2026-01-10T00:00:00.000Z',
      });
    expect(none.status).toBe(400);

    const bad = await createManual({}, { ...hay(), ndfPct: 30, adfPct: 40 });
    expect(bad.status).toBe(400);
    expect(JSON.stringify(bad.body)).toContain('ndfPct');
    expect((await createManual({}, hay(200))).status).toBe(400);
  });

  it('copies nutrition once from a linked catalogue ingredient', async () => {
    const ingredient = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...auth(owner))
      .send({
        name: `E2E Copy Ingredient ${Date.now()}-${Math.random()}`,
        pricePerKg: 12,
        dmPct: 90,
        cpPct: 22,
        meMjPerKgDm: 12,
      })
      .expect(201);
    const res = await createManual({
      ingredientId: ingredient.body.data.id,
      nutrition: undefined,
    });
    expect(res.status).toBe(201);
    expect(res.body.data.nutrition.cpPct).toBe(22);
    expect(res.body.data.nutrition.copiedFromIngredientId).toBe(
      ingredient.body.data.id,
    );
  });

  it('restock adds a separate lot with its own nutrition; the product shows summed stock', async () => {
    const created = await createManual();
    const id = created.body.data.id as string;

    const res = await restock(id, {
      currentStock: 20,
      costPerUnit: 7,
      purchaseDate: '2026-02-10T00:00:00.000Z',
      batchCode: 'LOT-B',
      nutrition: hay(14),
    });
    expect(res.status).toBe(201);
    const item = res.body.data;
    expect(item.batches.map((b: { batchCode: string }) => b.batchCode)).toEqual(
      ['LOT-A', 'LOT-B'],
    );
    expect(item.batches[0].nutrition.cpPct).toBe(9); // old lot untouched
    expect(item.batches[1].nutrition.cpPct).toBe(14);
    expect(item.currentStock).toBe(30);
    expect(item.costPerUnit).toBe(7); // newest lot's cost (legacy mirror)

    const list = await request(server())
      .get(api('/inventory/feed-items?search=' + encodeURIComponent(item.name)))
      .set(...auth(owner))
      .expect(200);
    const rows = (list.body.data.items ?? list.body.data) as unknown[];
    expect(rows).toHaveLength(1);

    // A restock without nutrition inherits the item's default profile.
    const inherit = await restock(id, {
      currentStock: 5,
      costPerUnit: 8,
      purchaseDate: '2026-03-10T00:00:00.000Z',
    });
    expect(inherit.status).toBe(201);
    expect(inherit.body.data.batches[2].nutrition.cpPct).toBe(14);
  });

  it('draws FIFO across lots, one movement per lot; refuses to go below zero', async () => {
    const created = await createManual();
    const id = created.body.data.id as string;
    await restock(id, {
      currentStock: 20,
      costPerUnit: 7,
      purchaseDate: '2026-02-10T00:00:00.000Z',
      batchCode: 'LOT-B',
      nutrition: hay(14),
    });

    // 10 in LOT-A + 20 in LOT-B; take 14 => LOT-A emptied, 4 from LOT-B.
    await feedItems.adjustStock(owner.farmId, ownerUserId, id, {
      adjustment: -14,
      reason: 'ADJUSTMENT',
    });

    const after = await request(server())
      .get(api(`/inventory/feed-items/${id}`))
      .set(...auth(owner))
      .expect(200);
    const [a, b] = after.body.data.batches;
    expect(a.currentStock).toBe(0);
    expect(b.currentStock).toBe(16);
    expect(after.body.data.currentStock).toBe(16);

    const movements = await prisma.feedItemStockMovement.findMany({
      where: { feedItemId: id, reason: 'ADJUSTMENT' },
      orderBy: { createdAt: 'asc' },
    });
    expect(movements.map((m) => m.delta)).toEqual([-10, -4]);
    expect(movements.every((m) => m.feedItemBatchId)).toBe(true);
    expect(movements[movements.length - 1].balanceAfter).toBe(16);

    await expect(
      feedItems.adjustStock(owner.farmId, ownerUserId, id, {
        adjustment: -999,
        reason: 'ADJUSTMENT',
      }),
    ).rejects.toThrow('Stock cannot go below zero');
  });

  it('a pinned batchId draws from that lot only', async () => {
    const created = await createManual();
    const id = created.body.data.id as string;
    const withB = await restock(id, {
      currentStock: 20,
      costPerUnit: 7,
      purchaseDate: '2026-02-10T00:00:00.000Z',
      nutrition: hay(14),
    });
    const lotB = withB.body.data.batches[1].id as string;
    await feedItems.adjustStock(owner.farmId, ownerUserId, id, {
      adjustment: -5,
      reason: 'ADJUSTMENT',
      batchId: lotB,
    });
    const after = await request(server())
      .get(api(`/inventory/feed-items/${id}`))
      .set(...auth(owner))
      .expect(200);
    expect(after.body.data.batches[0].currentStock).toBe(10);
    expect(after.body.data.batches[1].currentStock).toBe(15);
  });

  it('reconciles lots when a legacy caller changed the item total directly (interim, until 446)', async () => {
    const created = await createManual();
    const id = created.body.data.id as string;
    await restock(id, {
      currentStock: 20,
      costPerUnit: 7,
      purchaseDate: '2026-02-10T00:00:00.000Z',
      nutrition: hay(14),
    });

    // Simulate feed distribution decrementing the legacy column only (30 -> 26).
    await prisma.feedItem.update({ where: { id }, data: { currentStock: 26 } });

    const res = await request(server())
      .patch(api(`/inventory/feed-items/${id}`))
      .set(...auth(owner))
      .send({ currentStock: 26 })
      .expect(200);
    const sum = res.body.data.batches.reduce(
      (s: number, b: { currentStock: number }) => s + b.currentStock,
      0,
    );
    expect(sum).toBe(26);
    expect(res.body.data.currentStock).toBe(26);
    // The oldest lot absorbed the decrease (that is what consumption is).
    expect(res.body.data.batches[0].currentStock).toBe(6);
  });

  it('edits a lot nutrition (manager+), reverts it, rejects a stale edit; worker is forbidden', async () => {
    const created = await createManual();
    const id = created.body.data.id as string;
    const batch = created.body.data.batches[0];
    const url = `/inventory/feed-items/${id}/batches/${batch.id}/nutrition`;

    await request(server())
      .patch(api(url))
      .set(...auth(worker))
      .send({ nutrition: hay(12) })
      .expect(403);

    const edited = await request(server())
      .patch(api(url))
      .set(...auth(owner))
      .send({ nutrition: hay(12), expectedUpdatedAt: batch.updatedAt })
      .expect(200);
    expect(edited.body.data.batches[0].nutrition.cpPct).toBe(12);
    expect(edited.body.data.batches[0].nutrition.supersedesId).toBe(
      batch.nutritionProfileId,
    );

    // The same (now stale) expectedUpdatedAt is refused.
    await request(server())
      .patch(api(url))
      .set(...auth(owner))
      .send({ nutrition: hay(13), expectedUpdatedAt: batch.updatedAt })
      .expect(409);

    const reverted = await request(server())
      .post(api(`${url}/revert`))
      .set(...auth(owner))
      .expect(201);
    expect(reverted.body.data.batches[0].nutrition.cpPct).toBe(9);

    // An inconsistent edit is rejected before it can reach live ration plans.
    await request(server())
      .patch(api(url))
      .set(...auth(owner))
      .send({ nutrition: { ...hay(), ndfPct: 10, adfPct: 40 } })
      .expect(400);
  });

  it('blocks nutrition edits on an archived item', async () => {
    const created = await createManual();
    const id = created.body.data.id as string;
    const batch = created.body.data.batches[0];
    await request(server())
      .patch(api(`/inventory/feed-items/${id}/archive`))
      .set(...auth(owner))
      .expect(200);
    await request(server())
      .patch(api(`/inventory/feed-items/${id}/batches/${batch.id}/nutrition`))
      .set(...auth(owner))
      .send({ nutrition: hay(12) })
      .expect(400);
  });

  it('finds lots by batch code (recall lookup), case-insensitive and farm-scoped', async () => {
    const code = `RECALL-${Date.now()}`;
    await createManual({ batchCode: code });
    const res = await request(server())
      .get(
        api(`/inventory/feed-items/by-batch-code?code=${code.toLowerCase()}`),
      )
      .set(...auth(owner))
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].batchCode).toBe(code);
    expect(res.body.data[0].feedItem.name).toContain('E2E Batch Hay');
    const none = await request(server())
      .get(api('/inventory/feed-items/by-batch-code?code=NOPE-000'))
      .set(...auth(owner))
      .expect(200);
    expect(none.body.data).toHaveLength(0);
  });
});
