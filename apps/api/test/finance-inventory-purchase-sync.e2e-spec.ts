import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-085 — Finance `INVENTORY_PURCHASE` transactions sync real inventory
 * stock. Replaces the old raw-Prisma, name-matched, unconditional increment
 * with an ID-based dispatch into each inventory service's own audited
 * `adjustStock`, gated on the wizard's `updateInventory` flag.
 *
 * Creates its own isolated Medicine rows via Prisma (unique names) to avoid
 * colliding with shared seeded data across parallel e2e workers.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Finance — inventory purchase stock sync (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createMedicine(currentStock: number) {
    const now = new Date();
    return prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: `E2E RAKHAL085 Med ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        type: 'LIQUID',
        category: 'ANTIBIOTIC',
        unit: 'ml',
        currentStock,
        costPerUnit: 10,
        lowStockThreshold: 0,
        purchaseDate: now,
        expiryDate: new Date(now.getTime() + 90 * 86_400_000),
        createdBy: ownerUserId,
      },
    });
  }

  function postPurchase(user: AuthedUser, body: Record<string, unknown>) {
    return request(server())
      .post(api('/finance/transactions'))
      .set(...bearer(user))
      .send({
        type: 'INVENTORY_PURCHASE',
        category: 'INVENTORY',
        amount: 500,
        paymentMethod: 'CASH',
        quantity: 20,
        ...body,
      });
  }

  it('increments Medicine stock and writes an audited MedicineStockMovement when updateInventory is true', async () => {
    const medicine = await createMedicine(10);

    const res = await postPurchase(owner, {
      updateInventory: true,
      inventoryItemId: medicine.id,
      inventoryItemType: 'MEDICINE',
    }).expect(201);

    expect(res.body.data.inventoryUpdated).toBe(true);

    const after = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(after.currentStock).toBe(30);

    const movements = await prisma.medicineStockMovement.findMany({
      where: { medicineId: medicine.id },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].reason).toBe('PURCHASE');
    expect(movements[0].delta).toBe(20);
    expect(movements[0].balanceAfter).toBe(30);
  });

  it('leaves stock untouched when updateInventory is false (Skip)', async () => {
    const medicine = await createMedicine(10);

    const res = await postPurchase(owner, {
      updateInventory: false,
      inventoryItemId: medicine.id,
      inventoryItemType: 'MEDICINE',
    }).expect(201);

    expect(res.body.data.inventoryUpdated).toBe(false);

    const after = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(after.currentStock).toBe(10);

    const movements = await prisma.medicineStockMovement.findMany({
      where: { medicineId: medicine.id },
    });
    expect(movements).toHaveLength(0);
  });

  it('400s when updateInventory is true but inventoryItemId/inventoryItemType are missing', async () => {
    await postPurchase(owner, { updateInventory: true }).expect(400);
  });

  it('404s when inventoryItemId does not belong to this farm', async () => {
    await postPurchase(owner, {
      updateInventory: true,
      inventoryItemId: 'nonexistent-id',
      inventoryItemType: 'MEDICINE',
    }).expect(404);
  });

  it('403s for a worker without finance.create', async () => {
    const medicine = await createMedicine(10);
    await postPurchase(worker, {
      updateInventory: true,
      inventoryItemId: medicine.id,
      inventoryItemType: 'MEDICINE',
    }).expect(403);
  });
});
