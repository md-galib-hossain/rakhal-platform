import request from 'supertest';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-446 (MILESTONE 26) — feeding draws real feed lots FIFO. A Feeding Grid confirm splits a cow's
 * share across lots (one cow-line per cow per lot, exact lot cost + nutrition profile); a void credits
 * back exactly the lot that cow-line drew from; a concentration distribution prices and profiles its
 * linked-ingredient line from the lots it drew. Requires the dev stack up + `pnpm seed` + the
 * RAKHAL-442/444/446 migrations.
 */
describe('Feed lots in feeding (e2e, RAKHAL-446)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let prisma: PrismaService;
  let cowA: string;
  let cowB: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();
  const tag = (label: string) =>
    `E2E-446-${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

  const lotOne = { dmPct: 88, cpPct: 9, meMjPerKgDm: 8.5 };
  const lotTwo = { dmPct: 90, cpPct: 15, meMjPerKgDm: 10 };

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    prisma = ctx.app.get(PrismaService);
    for (const label of ['A', 'B']) {
      const res = await request(server())
        .post(api('/cattle'))
        .set(...bearer(owner))
        .send({ tagNumber: tag(label), gender: 'FEMALE' })
        .expect(201);
      if (label === 'A') cowA = res.body.data.id as string;
      else cowB = res.body.data.id as string;
    }
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  /** Item with two lots: 10 kg @ ৳5 (older) then 20 kg @ ৳8 — FIFO drains the first lot first. */
  async function createTwoLotItem(ingredientId?: string) {
    const created = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...bearer(owner))
      .send({
        name: `E2E-446 Hay ${Date.now()}-${Math.random()}`,
        feedClass: 'FORAGE',
        unitId: 'unit_kg',
        ...(ingredientId ? { ingredientId } : {}),
        currentStock: 10,
        costPerUnit: 5,
        purchaseDate: '2026-01-10T00:00:00.000Z',
        batchCode: 'LOT-1',
        nutrition: lotOne,
      })
      .expect(201);
    const id = (created.body.data as { id: string }).id;
    await request(server())
      .post(api(`/inventory/feed-items/${id}/batches`))
      .set(...bearer(owner))
      .send({
        currentStock: 20,
        costPerUnit: 8,
        purchaseDate: '2026-02-10T00:00:00.000Z',
        batchCode: 'LOT-2',
        nutrition: lotTwo,
      })
      .expect(201);
    return id;
  }

  const lots = async (itemId: string) =>
    (
      await request(server())
        .get(api(`/inventory/feed-items/${itemId}`))
        .set(...bearer(owner))
        .expect(200)
    ).body.data as {
      currentStock: number;
      batches: { id: string; batchCode: string; currentStock: number }[];
    };

  const confirmBoth = (itemId: string, date: string) =>
    request(server())
      .post(api('/feed/grid/confirm'))
      .set(...bearer(owner))
      .send({
        date,
        entries: [
          {
            cattleId: cowA,
            offeredKg: 6,
            sourceType: 'FEED_ITEM',
            feedItemId: itemId,
          },
          {
            cattleId: cowB,
            offeredKg: 8,
            sourceType: 'FEED_ITEM',
            feedItemId: itemId,
          },
        ],
      })
      .expect(201);

  it('a grid confirm splits a cow across lots, with exact lot cost and profile per cow-line', async () => {
    const itemId = await createTwoLotItem();
    const res = await confirmBoth(itemId, '2026-03-11');

    // Response stays one entry per cow even though cow B spans two lots.
    expect(res.body.data.cows).toHaveLength(2);
    // 10 kg @5 + 4 kg @8 = 50 + 32
    expect(res.body.data.total_actual_cost).toBe(82);

    const after = await lots(itemId);
    expect(after.batches.map((b) => [b.batchCode, b.currentStock])).toEqual([
      ['LOT-1', 0],
      ['LOT-2', 16],
    ]);
    expect(after.currentStock).toBe(16);

    const dist = await prisma.feedDistribution.findUniqueOrThrow({
      where: { id: res.body.data.id as string },
      include: { items: true, cattleItems: true },
    });
    // One group-level line per lot; three cow-lines (A:LOT-1, B:LOT-1, B:LOT-2).
    expect(dist.items).toHaveLength(2);
    expect(dist.cattleItems).toHaveLength(3);
    const byBatch = new Map(after.batches.map((b) => [b.batchCode, b.id]));
    const cowBRows = dist.cattleItems.filter((c) => c.cattleId === cowB);
    expect(cowBRows).toHaveLength(2);
    const bLot2 = cowBRows.find(
      (c) => c.feedItemBatchId === byBatch.get('LOT-2'),
    )!;
    expect(bLot2.offeredKg).toBe(4);
    expect(bLot2.costTk).toBe(32);
    expect(bLot2.cpPct).toBe(15);
    expect(bLot2.nutritionProfileId).toBeTruthy();
    const aRow = dist.cattleItems.find((c) => c.cattleId === cowA)!;
    expect(aRow.costTk).toBe(30);
    expect(aRow.cpPct).toBe(9);

    // Every cow-line has its own per-lot DISTRIBUTION movement.
    const movements = await prisma.feedItemStockMovement.findMany({
      where: { feedItemId: itemId, reason: 'DISTRIBUTION' },
    });
    expect(movements).toHaveLength(3);
    expect(
      movements.every(
        (m) => m.feedDistributionCattleItemId && m.feedItemBatchId,
      ),
    ).toBe(true);
  });

  it('voiding a cow-line credits back exactly the lot it drew from', async () => {
    const itemId = await createTwoLotItem();
    const res = await confirmBoth(itemId, '2026-03-12');
    const distId = res.body.data.id as string;
    const before = await lots(itemId);
    const lot2 = before.batches.find((b) => b.batchCode === 'LOT-2')!;

    const rows = await prisma.feedDistributionCattleItem.findMany({
      where: {
        distributionId: distId,
        cattleId: cowB,
        feedItemBatchId: lot2.id,
      },
    });
    expect(rows).toHaveLength(1);
    await request(server())
      .post(api(`/feed/grid/distributions/${distId}/cattle/${rows[0].id}/void`))
      .set(...bearer(owner))
      .send({ reason: 'mis-entered' })
      .expect(201);

    const after = await lots(itemId);
    expect(after.batches.map((b) => [b.batchCode, b.currentStock])).toEqual([
      ['LOT-1', 0], // untouched — the void did not spill into the older lot
      ['LOT-2', 20], // exactly the 4 kg it drew, credited back to LOT-2
    ]);

    // The group-level line of that lot shrank by the voided share.
    const line = await prisma.feedDistributionItem.findFirstOrThrow({
      where: { distributionId: distId, feedItemBatchId: lot2.id },
    });
    expect(line.actualKg).toBe(0);
    expect(line.lineCost).toBe(0);
  });

  it('a concentration distribution prices and profiles its linked line from the lots drawn', async () => {
    const ingredient = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...bearer(owner))
      .send({
        name: `E2E-446 Ingredient ${Date.now()}-${Math.random()}`,
        pricePerKg: 1,
        dmPct: 50,
        cpPct: 5,
        meMjPerKgDm: 5,
      })
      .expect(201);
    const ingredientId = (ingredient.body.data as { id: string }).id;
    const itemId = await createTwoLotItem(ingredientId);

    const conc = await request(server())
      .post(api('/feed/concentrations'))
      .set(...bearer(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E-446 Formula ${Date.now()}`,
        items: [{ ingredientId, amountKg: 14 }],
      })
      .expect(201);
    const concentrationId = (conc.body.data as { id: string }).id;

    const dist = await request(server())
      .post(api('/feed/distributions'))
      .set(...bearer(owner))
      .send({ concentrationId })
      .expect(201);

    // 10 kg from LOT-1 (৳5) + 4 kg from LOT-2 (৳8) = ৳82, not 14 × the catalogue price.
    const line = await prisma.feedDistributionItem.findFirstOrThrow({
      where: { distributionId: dist.body.data.id as string, ingredientId },
    });
    expect(line.lineCost).toBe(82);
    expect(line.pricePerKg).toBe(5.86);
    // A line spanning two profiles has no single profile/lot — the snapshot is a blend.
    expect(line.feedItemBatchId).toBeNull();
    expect(line.nutritionProfileId).toBeNull();
    expect(line.dmPct).toBeGreaterThan(88);
    expect(line.dmPct).toBeLessThan(90);

    const after = await lots(itemId);
    expect(after.batches.map((b) => b.currentStock)).toEqual([0, 16]);
  });
});
