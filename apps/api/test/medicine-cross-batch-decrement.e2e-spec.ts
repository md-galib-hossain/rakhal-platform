import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RD-003 — cross-batch dose splitting. `MedicineService.decrementForTreatment`'s
 * FIFO-by-name path (`decrementAcrossBatches`) now draws from multiple batches
 * of the same medicine name, earliest-expiry first, when the first batch alone
 * can't cover the requested quantity — instead of erroring out. The explicit
 * `medicineId` path (`decrementSingleBatch`) deliberately stays single-batch
 * (no silent cross-batch draw when the caller names one exact batch).
 *
 * Creates its own isolated Cattle/Medicine rows via Prisma (unique names/tags)
 * to avoid colliding with shared seeded data across parallel e2e workers.
 *
 * Requires the dev stack up + `pnpm seed`.
 */
describe('Medicine — cross-batch dose splitting (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

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

  async function createCow() {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-RD003-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        purpose: 'MILK',
        createdBy: ownerUserId,
      },
    });
  }

  async function createBatch(
    name: string,
    batchId: string,
    currentStock: number,
    expiryDaysFromNow: number,
  ) {
    const now = new Date();
    return prisma.medicine.create({
      data: {
        farmId: owner.farmId,
        name,
        type: 'INJECTABLE',
        category: 'ANTIBIOTIC',
        batchId,
        unitId: 'unit_ml',
        currentStock,
        costPerUnit: 10,
        lowStockThreshold: 0,
        purchaseDate: now,
        expiryDate: new Date(now.getTime() + expiryDaysFromNow * 86_400_000),
        createdBy: ownerUserId,
      },
    });
  }

  async function openCase(cattleId: string) {
    const res = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        diagnosis: 'RD-003 e2e case',
        diagnosisType: 'DISEASE',
        priority: 'MEDIUM',
      })
      .expect(201);
    return res.body.data.id as string;
  }

  it('splits a dose across two batches by expiry order when the first batch is insufficient', async () => {
    const cow = await createCow();
    const medName = `E2E RD003 Med ${Date.now()}`;
    const early = await createBatch(medName, 'BATCH-EARLY', 5, 30); // expires sooner
    const later = await createBatch(medName, 'BATCH-LATER', 20, 90); // expires later
    const caseId = await openCase(cow.id);

    const res = await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({
        medicineName: medName,
        doseAmount: 12,
        doseUnit: 'ml',
        route: 'IM',
        stockDeductionQuantity: 12,
      })
      .expect(201);

    expect(res.body.data.treatmentLog.stockDeducted).toBe(true);
    // Primary batch reported on the TreatmentLog is the earliest-expiry one.
    expect(res.body.data.treatmentLog.batchNo).toBe('BATCH-EARLY');

    const earlyAfter = await prisma.medicine.findUniqueOrThrow({
      where: { id: early.id },
    });
    const laterAfter = await prisma.medicine.findUniqueOrThrow({
      where: { id: later.id },
    });
    // 5 fully drawn from the earlier batch, remaining 7 from the later one.
    expect(earlyAfter.currentStock).toBe(0);
    expect(laterAfter.currentStock).toBe(13);

    const movements = await prisma.medicineStockMovement.findMany({
      where: { medicineId: { in: [early.id, later.id] } },
      orderBy: { createdAt: 'asc' },
    });
    expect(movements).toHaveLength(2);
    expect(movements.map((m) => m.delta).sort((a, b) => a - b)).toEqual([
      -7, -5,
    ]);
  });

  it('400s when combined stock across all batches of that name is still insufficient', async () => {
    const cow = await createCow();
    const medName = `E2E RD003 Short ${Date.now()}`;
    await createBatch(medName, 'BATCH-A', 3, 30);
    await createBatch(medName, 'BATCH-B', 4, 60);
    const caseId = await openCase(cow.id);

    await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({
        medicineName: medName,
        doseAmount: 10,
        doseUnit: 'ml',
        route: 'IM',
        stockDeductionQuantity: 10,
      })
      .expect(400);

    const batches = await prisma.medicine.findMany({
      where: { farmId: owner.farmId, name: medName },
    });
    // Nothing written — the whole plan is rejected before any batch is touched.
    expect(batches.map((b) => b.currentStock).sort()).toEqual([3, 4]);
  });

  it('does not cross-batch split when an explicit medicineId is given, even if another batch of the same name has stock', async () => {
    const cow = await createCow();
    const medName = `E2E RD003 Explicit ${Date.now()}`;
    const chosen = await createBatch(medName, 'BATCH-CHOSEN', 3, 30);
    await createBatch(medName, 'BATCH-OTHER', 50, 60);
    const caseId = await openCase(cow.id);

    await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({
        medicineId: chosen.id,
        doseAmount: 10,
        doseUnit: 'ml',
        route: 'IM',
        stockDeductionQuantity: 10,
      })
      .expect(400);

    const chosenAfter = await prisma.medicine.findUniqueOrThrow({
      where: { id: chosen.id },
    });
    expect(chosenAfter.currentStock).toBe(3);
  });
});
