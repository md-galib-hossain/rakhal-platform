import request from 'supertest';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { SellInventoryUseCase } from 'src/modules/sales/application/use-cases/sell-inventory/sell-inventory.use-case';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-437 (`docs/EPIC_MEDICINE_BATCH_MODEL.md`) — Health/Sales consumption
 * reads batch-scoped cost, not product-level. Proves two real bugs the old
 * product-level `Medicine.costPerUnit` pre-read had, both only surfacing once
 * a product carries more than one batch (RAKHAL-434/436):
 *
 * 1. A dose that splits across two differently-priced batches used to be
 *    priced entirely off the *first* (representative) batch's cost — wrong
 *    the moment a split happened. Now priced off the actual batches drawn.
 * 2. A sale whose quantity the product's *summed* stock covers, but no single
 *    batch alone does, used to 400 (`adjustStock`'s single-batch semantics).
 *    Now FIFO-draws + splits across batches like treatment consumption does.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Medicine — batch-scoped consumption cost (e2e, RAKHAL-437)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let sellInventory: SellInventoryUseCase;
  let owner: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const uniqueName = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    sellInventory = ctx.app.get(SellInventoryUseCase);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  /** A catalog row with zero of its own stock — every real batch below is
   * added explicitly via `POST /inventory/medicines/:id/batches` (RAKHAL-436)
   * so the test controls each lot's own cost/expiry precisely. */
  async function createMedicineProduct() {
    const now = new Date();
    return prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: uniqueName('E2E-437-Medicine'),
        type: 'INJECTABLE',
        category: 'ANTIBIOTIC',
        unitId: 'unit_ml',
        currentStock: 0,
        costPerUnit: 0,
        lowStockThreshold: 0,
        purchaseDate: now,
        expiryDate: new Date(now.getTime() + 365 * 86_400_000),
        createdBy: ownerUserId,
      },
    });
  }

  async function addBatch(
    medicineId: string,
    opts: {
      batchCode: string;
      currentStock: number;
      costPerUnit: number;
      expiryDaysFromNow: number;
    },
  ) {
    await request(server())
      .post(api(`/inventory/medicines/${medicineId}/batches`))
      .set(...bearer(owner))
      .send({
        batchCode: opts.batchCode,
        currentStock: opts.currentStock,
        costPerUnit: opts.costPerUnit,
        purchaseDate: new Date().toISOString(),
        expiryDate: new Date(
          Date.now() + opts.expiryDaysFromNow * 86_400_000,
        ).toISOString(),
      })
      .expect(201);
  }

  async function createCow() {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: uniqueName('E2E-437-Cow'),
        gender: 'FEMALE',
        createdBy: ownerUserId,
      },
    });
  }

  it('prices a split treatment dose from the actual batches drawn, not the representative batch alone', async () => {
    const medicine = await createMedicineProduct();
    // Earlier-expiry (drawn first), cheaper.
    await addBatch(medicine.id, {
      batchCode: 'LOT-A',
      currentStock: 5,
      costPerUnit: 10,
      expiryDaysFromNow: 30,
    });
    // Later-expiry (drawn second), pricier.
    await addBatch(medicine.id, {
      batchCode: 'LOT-B',
      currentStock: 20,
      costPerUnit: 25,
      expiryDaysFromNow: 90,
    });

    const cattleId = (await createCow()).id;
    const res = await request(server())
      .post(api('/health/treatments'))
      .set(...bearer(owner))
      .send({
        cattleIds: [cattleId],
        medicineId: medicine.id,
        doseAmount: 12, // draws all 5 of LOT-A (৳50) + 7 of LOT-B (৳175) = ৳225
        doseUnit: 'ml',
        route: 'IM',
        treatedAt: new Date().toISOString(),
      })
      .expect(201);

    const treatmentLogId = res.body.data.results[0].treatmentLogId as string;
    const log = await prisma.treatmentLog.findUniqueOrThrow({
      where: { id: treatmentLogId },
    });
    expect(log.financeTransactionId).not.toBeNull();

    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: log.financeTransactionId! },
    });
    // The old product-level guess (representative LOT-A's ৳10 × 12 = ৳120)
    // would have been wrong; the real batch-weighted cost is ৳225.
    expect(Number(expense.amount)).toBe(225);

    const batches = await prisma.medicineBatch.findMany({
      where: { medicineId: medicine.id },
      orderBy: { batchCode: 'asc' },
    });
    expect(batches.find((b) => b.batchCode === 'LOT-A')?.currentStock).toBe(0);
    expect(batches.find((b) => b.batchCode === 'LOT-B')?.currentStock).toBe(13);
  });

  it('sells across two batches when no single batch alone covers the quantity but the summed stock does', async () => {
    const medicine = await createMedicineProduct();
    await addBatch(medicine.id, {
      batchCode: 'LOT-X',
      currentStock: 5,
      costPerUnit: 8,
      expiryDaysFromNow: 30,
    });
    await addBatch(medicine.id, {
      batchCode: 'LOT-Y',
      currentStock: 20,
      costPerUnit: 8,
      expiryDaysFromNow: 90,
    });

    // 12 exceeds LOT-X's own 5 (would 400 under the old single-batch
    // `adjustStock` semantics) but is well within the summed 25.
    const result = await sellInventory.execute(owner.farmId, ownerUserId, {
      itemType: 'MEDICINE',
      itemId: medicine.id,
      quantity: 12,
      unitPrice: 20,
      saleDate: new Date().toISOString(),
    });
    expect(result.sale.status).toBe('CONFIRMED');

    const batches = await prisma.medicineBatch.findMany({
      where: { medicineId: medicine.id },
      orderBy: { batchCode: 'asc' },
    });
    expect(batches.find((b) => b.batchCode === 'LOT-X')?.currentStock).toBe(0);
    expect(batches.find((b) => b.batchCode === 'LOT-Y')?.currentStock).toBe(13);

    const movements = await prisma.medicineStockMovement.findMany({
      where: { medicineId: medicine.id, reason: 'SALE' },
    });
    expect(movements).toHaveLength(2);
    expect(movements.every((m) => m.saleLineId !== null)).toBe(true);

    const updatedMedicine = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(updatedMedicine.currentStock).toBe(13); // 25 - 12, summed across both batches
  });
});
