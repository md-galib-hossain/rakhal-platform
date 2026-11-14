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
 * RAKHAL-445 (MILESTONE 26) — purchasing and sales against real feed lots: a purchase line creates
 * its own lot (never blended), voiding it debits exactly that lot, a sale draws FIFO across lots and
 * voiding the sale restores each lot it drew from. Requires the dev stack up + `pnpm seed` + the
 * RAKHAL-442/444 migrations. Rows are left behind (purchase/sale documents reference them), like the
 * sibling purchasing/sales specs.
 */
describe('Feed lots in purchasing + sales (e2e, RAKHAL-445)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let prisma: PrismaService;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const hay = { dmPct: 88, cpPct: 9, meMjPerKgDm: 8.5 };

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    prisma = ctx.app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  /** Item with one opening lot: 10 kg @ ৳5, dated well in the past so FIFO puts it first. */
  async function createItem() {
    const res = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...bearer(owner))
      .send({
        name: `E2E-445 Hay ${Date.now()}-${Math.random()}`,
        feedClass: 'FORAGE',
        unitId: 'unit_kg',
        currentStock: 10,
        costPerUnit: 5,
        purchaseDate: '2026-01-10T00:00:00.000Z',
        batchCode: 'LOT-OPEN',
        nutrition: hay,
      })
      .expect(201);
    return res.body.data as { id: string; name: string };
  }

  async function purchase(
    itemId: string,
    quantity: number,
    unitCost: number,
    batchCode?: string,
  ) {
    const res = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [{ feedItemId: itemId, quantity, unitCost, batchCode }],
      })
      .expect(201);
    return res.body.data as { id: string };
  }

  const lots = async (itemId: string) =>
    (
      await request(server())
        .get(api(`/inventory/feed-items/${itemId}`))
        .set(...bearer(owner))
        .expect(200)
    ).body.data as {
      currentStock: number;
      costPerUnit: number;
      batches: {
        id: string;
        batchCode: string | null;
        currentStock: number;
        costPerUnit: number;
      }[];
    };

  it('a feed purchase creates its own lot with its own cost and code, and never blends into an older lot', async () => {
    const item = await createItem();
    const p1 = await purchase(item.id, 20, 8, 'LOT-P1');
    await purchase(item.id, 5, 9, 'LOT-P2');

    const detail = await lots(item.id);
    expect(detail.batches.map((b) => b.batchCode)).toEqual([
      'LOT-OPEN',
      'LOT-P1',
      'LOT-P2',
    ]);
    expect(detail.batches.map((b) => b.currentStock)).toEqual([10, 20, 5]);
    expect(detail.batches.map((b) => b.costPerUnit)).toEqual([5, 8, 9]);
    expect(detail.currentStock).toBe(35);

    // The purchase line names the exact lot it created; a PURCHASE movement is written against it.
    const line = await prisma.purchaseLine.findFirstOrThrow({
      where: { purchaseId: p1.id },
    });
    const lotP1 = detail.batches[1];
    expect(line.feedItemBatchId).toBe(lotP1.id);
    const movement = await prisma.feedItemStockMovement.findFirstOrThrow({
      where: { feedItemBatchId: lotP1.id, reason: 'PURCHASE' },
    });
    expect(movement.delta).toBe(20);
  });

  it('voiding a purchase debits exactly the lot it created, not an older or newer lot', async () => {
    const item = await createItem();
    const p1 = await purchase(item.id, 20, 8, 'LOT-P1');
    await purchase(item.id, 5, 9, 'LOT-P2');

    await request(server())
      .post(api(`/purchasing/purchases/${p1.id}/void`))
      .set(...bearer(owner))
      .expect(201);

    const detail = await lots(item.id);
    const byCode = Object.fromEntries(
      detail.batches.map((b) => [b.batchCode, b.currentStock]),
    );
    expect(byCode['LOT-OPEN']).toBe(10); // untouched (the old FIFO guess would have drained this)
    expect(byCode['LOT-P1']).toBe(0);
    expect(byCode['LOT-P2']).toBe(5);
    expect(detail.currentStock).toBe(15);
  });

  it('a sale draws FIFO across lots with one movement per lot; voiding it restores each lot exactly', async () => {
    const item = await createItem();
    await purchase(item.id, 20, 8, 'LOT-P1');

    const sale = await request(server())
      .post(api('/sales/inventory'))
      .set(...bearer(owner))
      .send({
        itemType: 'FEED_ITEM',
        itemId: item.id,
        quantity: 14,
        unitPrice: 20,
        saleDate: new Date().toISOString(),
      })
      .expect(201);
    const saleId = (sale.body.data as { sale: { id: string } }).sale.id;

    // 10 in LOT-OPEN + 20 in LOT-P1; selling 14 empties the oldest lot and takes 4 from the next.
    const afterSale = await lots(item.id);
    expect(afterSale.batches.map((b) => b.currentStock)).toEqual([0, 16]);
    const drawn = await prisma.feedItemStockMovement.findMany({
      where: { feedItemId: item.id, reason: 'SALE' },
      orderBy: { createdAt: 'asc' },
    });
    expect(drawn.map((m) => m.delta)).toEqual([-10, -4]);
    expect(drawn.every((m) => m.saleLineId && m.feedItemBatchId)).toBe(true);

    await request(server())
      .post(api(`/sales/${saleId}/cancel`))
      .set(...bearer(owner))
      .expect(201);

    const restored = await lots(item.id);
    expect(restored.batches.map((b) => b.currentStock)).toEqual([10, 20]);
    expect(restored.currentStock).toBe(30);
    const back = await prisma.feedItemStockMovement.findMany({
      where: { feedItemId: item.id, reason: 'ADJUSTMENT' },
      orderBy: { createdAt: 'asc' },
    });
    expect(back.map((m) => m.delta)).toEqual([10, 4]);
    // Each restore lands on the lot the sale drew from, not the newest lot.
    expect(back.map((m) => m.feedItemBatchId)).toEqual(
      drawn.map((m) => m.feedItemBatchId),
    );
  });

  it('a purchase price refreshes the linked ingredient cost from the newest lot', async () => {
    const ingredient = await request(server())
      .post(api('/feed/ingredients/custom'))
      .set(...bearer(owner))
      .send({
        name: `E2E-445 Ingredient ${Date.now()}-${Math.random()}`,
        pricePerKg: 4,
        dmPct: 90,
        cpPct: 10,
        meMjPerKgDm: 9,
      })
      .expect(201);
    const ingredientId = (ingredient.body.data as { id: string }).id;
    const created = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...bearer(owner))
      .send({
        name: `E2E-445 Linked ${Date.now()}-${Math.random()}`,
        feedClass: 'CONCENTRATE',
        ingredientId,
        unitId: 'unit_kg',
        currentStock: 1,
        costPerUnit: 4,
        purchaseDate: '2026-01-10T00:00:00.000Z',
      })
      .expect(201);
    await purchase((created.body.data as { id: string }).id, 10, 17);

    const override = await prisma.feedIngredientOverride.findFirstOrThrow({
      where: { farmId: owner.farmId, ingredientId },
    });
    expect(override.customPricePerKg).toBe(17);
  });
});
