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
 * RAKHAL-439 (`docs/EPIC_MEDICINE_BATCH_MODEL.md`) — closes MILESTONE 8's
 * medicine-batch-model build order:
 *
 * 1. `GET /inventory/medicines/by-batch-code` — real batch lookup across the
 *    farm (a manufacturer recall use case).
 * 2. Void-document reverses the *exact* `MedicineBatch` a purchase line
 *    created (`PurchaseLine.medicineBatchId`, RAKHAL-436), not a
 *    representative-batch guess — proven with two purchases of the same
 *    product at different cost/expiry, voiding only the first.
 * 3. Void-sale restores the *exact* batch(es) a sale line drew from
 *    (`MedicineStockMovement.saleLineId`, RAKHAL-437), including a sale that
 *    split across two batches.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Medicine — batch lookup + batch-scoped void reversal (e2e, RAKHAL-439)', () => {
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

  async function createMedicineProduct() {
    const now = new Date();
    return prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: uniqueName('E2E-439-Medicine'),
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

  it('finds a batch by its code across the whole farm', async () => {
    const medicine = await createMedicineProduct();
    const code = `LOT-439-${Date.now()}`;
    await request(server())
      .post(api(`/inventory/medicines/${medicine.id}/batches`))
      .set(...bearer(owner))
      .send({
        batchCode: code,
        currentStock: 10,
        costPerUnit: 5,
        purchaseDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      })
      .expect(201);

    const res = await request(server())
      .get(api(`/inventory/medicines/by-batch-code?code=${code}`))
      .set(...bearer(owner))
      .expect(200);
    const results = res.body.data as {
      batchCode: string;
      medicineId: string;
    }[];
    expect(results).toHaveLength(1);
    expect(results[0].batchCode).toBe(code);
    expect(results[0].medicineId).toBe(medicine.id);
  });

  it('void-document destocks only the exact batch the voided purchase created, not a different batch of the same product', async () => {
    const medicine = await createMedicineProduct();

    const purchase1 = await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [
          {
            medicineId: medicine.id,
            quantity: 10,
            unitCost: 15,
            expiryDate: new Date(Date.now() + 60 * 86_400_000).toISOString(),
            batchCode: 'LOT-VOID-A',
          },
        ],
      })
      .expect(201);

    await request(server())
      .post(api('/purchasing/purchases'))
      .set(...bearer(owner))
      .send({
        purchaseDate: new Date().toISOString(),
        lines: [
          {
            medicineId: medicine.id,
            quantity: 20,
            unitCost: 25,
            expiryDate: new Date(Date.now() + 120 * 86_400_000).toISOString(),
            batchCode: 'LOT-VOID-B',
          },
        ],
      })
      .expect(201);

    const beforeVoid = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(beforeVoid.currentStock).toBe(30);

    await request(server())
      .post(api(`/purchasing/purchases/${purchase1.body.data.id}/void`))
      .set(...bearer(owner))
      .expect(201);

    const batches = await prisma.medicineBatch.findMany({
      where: { medicineId: medicine.id },
      orderBy: { batchCode: 'asc' },
    });
    // Only LOT-VOID-A (the voided purchase's own batch) is destocked; LOT-VOID-B untouched.
    expect(
      batches.find((b) => b.batchCode === 'LOT-VOID-A')?.currentStock,
    ).toBe(0);
    expect(
      batches.find((b) => b.batchCode === 'LOT-VOID-B')?.currentStock,
    ).toBe(20);

    const afterVoid = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(afterVoid.currentStock).toBe(20);
  });

  it('void-sale restores every exact batch a split sale drew from', async () => {
    const medicine = await createMedicineProduct();
    await request(server())
      .post(api(`/inventory/medicines/${medicine.id}/batches`))
      .set(...bearer(owner))
      .send({
        batchCode: 'LOT-SALE-X',
        currentStock: 5,
        costPerUnit: 8,
        purchaseDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 30 * 86_400_000).toISOString(),
      })
      .expect(201);
    await request(server())
      .post(api(`/inventory/medicines/${medicine.id}/batches`))
      .set(...bearer(owner))
      .send({
        batchCode: 'LOT-SALE-Y',
        currentStock: 20,
        costPerUnit: 8,
        purchaseDate: new Date().toISOString(),
        expiryDate: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      })
      .expect(201);

    const result = await sellInventory.execute(owner.farmId, ownerUserId, {
      itemType: 'MEDICINE',
      itemId: medicine.id,
      quantity: 12, // draws 5 from X (fully) + 7 from Y — split sale
      unitPrice: 20,
      saleDate: new Date().toISOString(),
    });

    const midBatches = await prisma.medicineBatch.findMany({
      where: { medicineId: medicine.id },
      orderBy: { batchCode: 'asc' },
    });
    expect(
      midBatches.find((b) => b.batchCode === 'LOT-SALE-X')?.currentStock,
    ).toBe(0);
    expect(
      midBatches.find((b) => b.batchCode === 'LOT-SALE-Y')?.currentStock,
    ).toBe(13);

    await request(server())
      .post(api(`/sales/${result.sale.id}/cancel`))
      .set(...bearer(owner))
      .expect(201);

    const restoredBatches = await prisma.medicineBatch.findMany({
      where: { medicineId: medicine.id },
      orderBy: { batchCode: 'asc' },
    });
    // Each batch restored to its own exact pre-sale amount — not both dumped
    // into whichever batch is currently representative.
    expect(
      restoredBatches.find((b) => b.batchCode === 'LOT-SALE-X')?.currentStock,
    ).toBe(5);
    expect(
      restoredBatches.find((b) => b.batchCode === 'LOT-SALE-Y')?.currentStock,
    ).toBe(20);

    const restoredMedicine = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(restoredMedicine.currentStock).toBe(25);
  });
});
