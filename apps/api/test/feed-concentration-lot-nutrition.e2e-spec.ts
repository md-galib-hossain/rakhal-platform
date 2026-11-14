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
 * RAKHAL-447 (MILESTONE 26, ADR-026 D7) — a recipe line that names an inventory product needs no
 * catalogue ingredient and takes its nutrition + price from that product's lot: the FIFO head, or the
 * lot the line pins. Distributing the recipe draws that same lot. Requires the dev stack up +
 * `pnpm seed` + the RAKHAL-442/444/446/447 migrations.
 */
describe('Recipe lines backed by feed lots (e2e, RAKHAL-447)', () => {
  let ctx: TestContext;
  let owner: AuthedUser;
  let prisma: PrismaService;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const lotOne = { dmPct: 88, cpPct: 9, meMjPerKgDm: 8.5 };
  const lotTwo = { dmPct: 90, cpPct: 15, meMjPerKgDm: 10 };

  beforeAll(async () => {
    ctx = await createTestApp();
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    prisma = ctx.app.get(PrismaService);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  /** A product with NO catalogue ingredient and two lots: 10 kg @ ৳5 (older), 20 kg @ ৳8. */
  async function createProduct() {
    const created = await request(server())
      .post(api('/inventory/feed-items'))
      .set(...bearer(owner))
      .send({
        name: `E2E-447 Meal ${Date.now()}-${Math.random()}`,
        feedClass: 'CONCENTRATE',
        unitId: 'unit_kg',
        currentStock: 10,
        costPerUnit: 5,
        purchaseDate: '2026-01-10T00:00:00.000Z',
        batchCode: 'LOT-1',
        nutrition: lotOne,
      })
      .expect(201);
    const { id, name } = created.body.data as { id: string; name: string };
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
    const detail = await request(server())
      .get(api(`/inventory/feed-items/${id}`))
      .set(...bearer(owner))
      .expect(200);
    const batches = (
      detail.body.data as { batches: { id: string; batchCode: string }[] }
    ).batches;
    return {
      id,
      name,
      lot1: batches.find((b) => b.batchCode === 'LOT-1')!.id,
      lot2: batches.find((b) => b.batchCode === 'LOT-2')!.id,
    };
  }

  const createRecipe = (items: Record<string, unknown>[]) =>
    request(server())
      .post(api('/feed/concentrations'))
      .set(...bearer(owner))
      .send({
        kind: 'CONCENTRATE_TEMPLATE',
        name: `E2E-447 Recipe ${Date.now()}-${Math.random()}`,
        items,
      });

  it('a product-only line needs no ingredient and takes the FIFO-head lot nutrition + price', async () => {
    const p = await createProduct();
    const res = await createRecipe([{ feedItemId: p.id, amountKg: 10 }]).expect(
      201,
    );
    const data = res.body.data as {
      totals: { dm_kg: number; cp_kg: number; total_cost_tk: number };
      ingredients: {
        ingredient_id: string | null;
        feed_item_id: string;
        name: string;
      }[];
    };
    expect(data.ingredients).toHaveLength(1);
    expect(data.ingredients[0].ingredient_id).toBeNull();
    expect(data.ingredients[0].feed_item_id).toBe(p.id);
    expect(data.ingredients[0].name).toBe(p.name);
    // LOT-1: 10 kg × 88% DM × 9% CP, at ৳5/kg.
    expect(data.totals.dm_kg).toBe(8.8);
    expect(data.totals.cp_kg).toBe(0.79);
    expect(data.totals.total_cost_tk).toBe(50);
  });

  it('pinning a lot makes the line use that lot, not the FIFO head', async () => {
    const p = await createProduct();
    const res = await createRecipe([
      { feedItemId: p.id, feedItemBatchId: p.lot2, amountKg: 10 },
    ]).expect(201);
    const data = res.body.data as {
      totals: { dm_kg: number; cp_kg: number; total_cost_tk: number };
      ingredients: { feed_item_batch_id: string }[];
    };
    expect(data.ingredients[0].feed_item_batch_id).toBe(p.lot2);
    // LOT-2: 10 kg × 90% DM × 15% CP, at ৳8/kg.
    expect(data.totals.dm_kg).toBe(9);
    expect(data.totals.cp_kg).toBe(1.35);
    expect(data.totals.total_cost_tk).toBe(80);
  });

  it('rejects a line with no identity, a pin without a product, and a pin from another product', async () => {
    const a = await createProduct();
    const b = await createProduct();
    await createRecipe([{ amountKg: 5 }]).expect(400);
    await createRecipe([{ feedItemBatchId: a.lot1, amountKg: 5 }]).expect(400);
    await createRecipe([
      { feedItemId: a.id, feedItemBatchId: b.lot1, amountKg: 5 },
    ]).expect(400);
  });

  it('distributing the recipe draws the same lots — the FIFO head, or the pinned lot only', async () => {
    const p = await createProduct();
    const headRecipe = await createRecipe([
      { feedItemId: p.id, amountKg: 10 },
    ]).expect(201);
    const pinnedRecipe = await createRecipe([
      { feedItemId: p.id, feedItemBatchId: p.lot2, amountKg: 10 },
    ]).expect(201);

    const d1 = await request(server())
      .post(api('/feed/distributions'))
      .set(...bearer(owner))
      .send({ concentrationId: (headRecipe.body.data as { id: string }).id })
      .expect(201);
    let lots = await prisma.feedItemBatch.findMany({
      where: { feedItemId: p.id },
      orderBy: { purchaseDate: 'asc' },
    });
    expect(lots.map((l) => l.currentStock)).toEqual([0, 20]);
    const line1 = await prisma.feedDistributionItem.findFirstOrThrow({
      where: { distributionId: (d1.body.data as { id: string }).id },
    });
    expect(line1.ingredientId).toBe(p.id); // product-only line is keyed by the product
    expect(line1.lineCost).toBe(50);
    expect(line1.feedItemBatchId).toBe(p.lot1);
    expect(line1.cpPct).toBe(9);

    await request(server())
      .post(api('/feed/distributions'))
      .set(...bearer(owner))
      .send({ concentrationId: (pinnedRecipe.body.data as { id: string }).id })
      .expect(201);
    lots = await prisma.feedItemBatch.findMany({
      where: { feedItemId: p.id },
      orderBy: { purchaseDate: 'asc' },
    });
    expect(lots.map((l) => l.currentStock)).toEqual([0, 10]);
  });
});
