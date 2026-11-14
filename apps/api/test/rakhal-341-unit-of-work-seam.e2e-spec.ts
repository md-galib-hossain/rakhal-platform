import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { MedicineService } from '../src/modules/inventory/application/services/medicine.service';
import { FeedItemService } from '../src/modules/inventory/application/services/feed-item.service';
import { EquipmentService } from '../src/modules/inventory/application/services/equipment.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { createFeedItemWithLot, feedItemStock } from './utils/feed-fixtures';

/**
 * RAKHAL-341 — Unit-of-Work seam. `MedicineService.adjustStock`,
 * `FeedItemService.adjustStock` and `EquipmentService.adjustStock` now accept
 * an optional trailing `tx?: Prisma.TransactionClient`, mirroring
 * `MilkTankService.adjustVolume`. This proves the actual point of the seam:
 * a caller that wraps the call inside its own `prisma.$transaction()` and
 * then throws must roll back BOTH the stock-quantity row and the
 * `*StockMovement` audit row together — nothing partially commits. Without
 * this, no future atomic sale use case (RAKHAL-342/345/346/349) could ever
 * be atomic, since inventory writes would always land on their own implicit
 * transaction regardless of the caller's outcome.
 *
 * Also proves the existing (no-`tx`) call path is completely unchanged —
 * a bare call still commits both rows on its own.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('RAKHAL-341 — inventory adjustStock unit-of-work seam (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let medicineService: MedicineService;
  let feedItemService: FeedItemService;
  let equipmentService: EquipmentService;
  let owner: AuthedUser;
  let ownerUserId: string;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    medicineService = ctx.app.get(MedicineService);
    feedItemService = ctx.app.get(FeedItemService);
    equipmentService = ctx.app.get(EquipmentService);
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

  const uniqueName = (prefix: string) =>
    `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

  async function createMedicine(currentStock: number) {
    const now = new Date();
    return prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: uniqueName('E2E RAKHAL-341 Medicine'),
        type: 'INJECTABLE',
        category: 'ANTIBIOTIC',
        unitId: 'unit_ml',
        currentStock,
        costPerUnit: 10,
        lowStockThreshold: 0,
        purchaseDate: now,
        expiryDate: new Date(now.getTime() + 90 * 86_400_000),
        createdBy: ownerUserId,
      },
    });
  }

  async function createFeedItem(currentStock: number) {
    const { item } = await createFeedItemWithLot(prisma, {
      farmId: owner.farmId,
      createdBy: ownerUserId,
      name: uniqueName('E2E RAKHAL-341 FeedItem'),
      feedClass: 'FORAGE',
      unitId: 'unit_kg',
      stock: currentStock,
      costPerUnit: 20,
      lowStockThreshold: 0,
    });
    return item;
  }

  async function createEquipment(currentStock: number) {
    return prisma.equipment.create({
      data: {
        farmId: owner.farmId,
        name: uniqueName('E2E RAKHAL-341 Equipment'),
        type: 'SUPPLY',
        unitId: 'unit_pcs',
        currentStock,
        costPerUnit: 5,
        lowStockThreshold: 0,
        purchaseDate: new Date(),
        createdBy: ownerUserId,
      },
    });
  }

  it('Medicine: rolls back the stock change AND the movement row when the caller transaction throws after adjustStock', async () => {
    const medicine = await createMedicine(50);

    await expect(
      prisma.$transaction(async (tx) => {
        await medicineService.adjustStock(
          owner.farmId,
          ownerUserId,
          medicine.id,
          { adjustment: -20, reason: 'CORRECTION' },
          tx,
        );
        throw new Error('simulated caller-side failure after adjustStock');
      }),
    ).rejects.toThrow('simulated caller-side failure');

    const after = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(after.currentStock).toBe(50); // untouched

    const movements = await prisma.medicineStockMovement.findMany({
      where: { medicineId: medicine.id },
    });
    expect(movements).toHaveLength(0); // untouched
  });

  it('Medicine: commits both rows when adjustStock is called without a tx (unchanged existing behaviour)', async () => {
    const medicine = await createMedicine(50);

    await medicineService.adjustStock(owner.farmId, ownerUserId, medicine.id, {
      adjustment: -20,
      reason: 'CORRECTION',
    });

    const after = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(after.currentStock).toBe(30);

    const movements = await prisma.medicineStockMovement.findMany({
      where: { medicineId: medicine.id },
    });
    expect(movements).toHaveLength(1);
    expect(movements[0].delta).toBe(-20);
  });

  it('FeedItem: rolls back the stock change AND the movement row when the caller transaction throws after adjustStock', async () => {
    const feedItem = await createFeedItem(100);

    await expect(
      prisma.$transaction(async (tx) => {
        await feedItemService.adjustStock(
          owner.farmId,
          ownerUserId,
          feedItem.id,
          { adjustment: -15, reason: 'CORRECTION' },
          tx,
        );
        throw new Error('simulated caller-side failure after adjustStock');
      }),
    ).rejects.toThrow('simulated caller-side failure');

    expect(await feedItemStock(prisma, feedItem.id)).toBe(100);

    const movements = await prisma.feedItemStockMovement.findMany({
      where: { feedItemId: feedItem.id },
    });
    expect(movements).toHaveLength(0);
  });

  it('Equipment: rolls back the stock change AND the movement row when the caller transaction throws after adjustStock', async () => {
    const equipment = await createEquipment(10);

    await expect(
      prisma.$transaction(async (tx) => {
        await equipmentService.adjustStock(
          owner.farmId,
          ownerUserId,
          equipment.id,
          { adjustment: -3, reason: 'CORRECTION' },
          tx,
        );
        throw new Error('simulated caller-side failure after adjustStock');
      }),
    ).rejects.toThrow('simulated caller-side failure');

    const after = await prisma.equipment.findUniqueOrThrow({
      where: { id: equipment.id },
    });
    expect(after.currentStock).toBe(10);

    const movements = await prisma.equipmentStockMovement.findMany({
      where: { equipmentId: equipment.id },
    });
    expect(movements).toHaveLength(0);
  });
});
