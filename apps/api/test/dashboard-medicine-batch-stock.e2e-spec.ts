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
 * RAKHAL-438 (`docs/EPIC_MEDICINE_BATCH_MODEL.md`) — verification, not a fix:
 * `Medicine.currentStock` has been a live-synced sum-of-batches since RAKHAL-435
 * (`MedicineService.syncMedicineAggregate`, run inside every batch-mutating
 * transaction — create/createBatch/update/adjustStock/decrementForTreatment/
 * decrementForSale), so `dashboard.service.ts#feedStockAlerts`'s same-row
 * `currentStock <= lowStockThreshold` compare (`dashboard.service.ts:801` for
 * the separate `priorities()` widget, `:697` here) was already correct —
 * nothing in the dashboard/reports consumer audit needed a code change. This
 * spec proves that live, across a real multi-batch product (two purchases,
 * one partial consumption), rather than leaving it an unverified assumption.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Dashboard — feed-stock-alerts reflects summed multi-batch Medicine stock (e2e, RAKHAL-438)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const uniqueName = (prefix: string) =>
    `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
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

  async function createMedicineProduct(lowStockThreshold: number) {
    const now = new Date();
    return prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name: uniqueName('E2E-438-Medicine'),
        type: 'INJECTABLE',
        category: 'ANTIBIOTIC',
        unitId: 'unit_ml',
        currentStock: 0,
        costPerUnit: 0,
        lowStockThreshold,
        purchaseDate: now,
        expiryDate: new Date(now.getTime() + 365 * 86_400_000),
        createdBy: ownerUserId,
      },
    });
  }

  async function addBatch(
    medicineId: string,
    currentStock: number,
    costPerUnit: number,
    expiryDaysFromNow: number,
  ) {
    await request(server())
      .post(api(`/inventory/medicines/${medicineId}/batches`))
      .set(...bearer(owner))
      .send({
        currentStock,
        costPerUnit,
        purchaseDate: new Date().toISOString(),
        expiryDate: new Date(
          Date.now() + expiryDaysFromNow * 86_400_000,
        ).toISOString(),
      })
      .expect(201);
  }

  it('low-stock alert threshold compares against the true sum across every batch, not one lot', async () => {
    const medicine = await createMedicineProduct(15);
    // Two batches summing to 20 — above the threshold of 15, so no alert yet.
    await addBatch(medicine.id, 8, 10, 30);
    await addBatch(medicine.id, 12, 10, 90);

    const before = await request(server())
      .get(api('/dashboard/feed-stock-alerts'))
      .set(...bearer(owner))
      .expect(200);
    const alertsBefore = before.body.data.alerts as { itemId: string }[];
    expect(alertsBefore.some((a) => a.itemId === medicine.id)).toBe(false);

    // Consume 8 via adjustStock (manual correction) — draws from the
    // representative (earliest-expiry) batch, leaving 12 total: now at/under
    // the threshold of 15.
    await request(server())
      .post(api(`/inventory/medicines/${medicine.id}/adjust-stock`))
      .set(...bearer(owner))
      .send({ adjustment: -8, reason: 'CORRECTION' })
      .expect(201);

    const updated = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicine.id },
    });
    expect(updated.currentStock).toBe(12); // 20 - 8, summed across both batches

    const after = await request(server())
      .get(api('/dashboard/feed-stock-alerts'))
      .set(...bearer(owner))
      .expect(200);
    const alertsAfter = after.body.data.alerts as {
      itemId: string;
      currentStock: number;
      threshold: number;
    }[];
    const ownAlert = alertsAfter.find((a) => a.itemId === medicine.id);
    expect(ownAlert).toBeDefined();
    expect(ownAlert!.currentStock).toBe(12);
    expect(ownAlert!.threshold).toBe(15);
  });
});
