import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { seededCashAccountId } from './utils/finance';

/**
 * RAKHAL-416 — `POST /health/treatments` records a treatment against one or
 * more animals with no case id. An open case for an animal is reused;
 * otherwise a minimal one is opened silently. Withdrawal is derived from the
 * medicine's own `milkWithdrawalDays`/`meatWithdrawalDays`, never typed.
 * Medicine stock decrements once per treated animal.
 */
describe('Health — quick treatment log (RAKHAL-416)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let medicineId: string;
  let noWithdrawalMedicineId: string;
  let financialAccountId: string;
  let cattleA: string; // no existing case
  let cattleB: string; // no existing case
  let cattleC: string; // has an existing open case, should be reused

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
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = ownerUser.id;
    // RAKHAL-419: both seeded medicines below carry a real costPerUnit, so
    // every /health/treatments call here needs a financialAccountId now.
    financialAccountId = await seededCashAccountId(ctx, owner);

    const stamp = Date.now();
    const makeCow = () =>
      prisma.cattle
        .create({
          data: {
            farmId: owner.farmId,
            tagNumber: `E2E-RAKHAL416-${stamp}-${Math.random().toString(36).slice(2, 7)}`,
            gender: 'FEMALE',
            createdBy: ownerUserId,
          },
        })
        .then((c) => c.id);
    cattleA = await makeCow();
    cattleB = await makeCow();
    cattleC = await makeCow();

    const unit = await prisma.unit.findFirstOrThrow({
      where: { farmId: null, symbol: 'mL' },
    });

    const makeMedicine = (
      milkWithdrawalDays: number,
      meatWithdrawalDays: number,
    ) =>
      prisma.medicine
        .create({
          data: {
            farmId: owner.farmId,
            name: `E2E-RAKHAL416-Med-${stamp}-${Math.random().toString(36).slice(2, 5)}`,
            type: 'INJECTABLE',
            category: 'ANTIBIOTIC',
            unitId: unit.id,
            currentStock: 1000,
            costPerUnit: 5,
            purchaseDate: new Date().toISOString(),
            expiryDate: new Date(Date.now() + 365 * 86_400_000).toISOString(),
            milkWithdrawalDays,
            meatWithdrawalDays,
            createdBy: ownerUserId,
          },
        })
        .then((m) => m.id);
    medicineId = await makeMedicine(4, 10);
    noWithdrawalMedicineId = await makeMedicine(0, 0);

    // cattleC already has an open case before any Quick Treat call.
    await prisma.healthCase.create({
      data: {
        farmId: owner.farmId,
        cattleId: cattleC,
        caseCode: `E2E-RAKHAL416-CASE-${stamp}`,
        diagnosis: 'Pre-existing case',
        diagnosisType: 'OTHER',
        priority: 'LOW',
        status: 'ACTIVE',
      },
    });
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('treats multiple animals in one call: writes logs, withdrawals, one stock movement each, reuses an open case', async () => {
    const stockBefore = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicineId },
      select: { currentStock: true },
    });

    const res = await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send({
        cattleIds: [cattleA, cattleB, cattleC],
        medicineId,
        doseAmount: 10,
        doseUnit: 'ml',
        route: 'IM',
        treatedAt: new Date().toISOString(),
        reason: 'E2E quick treat',
        financialAccountId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.appliedCount).toBe(3);
    const results: {
      cattleId: string;
      healthCaseId: string;
      treatmentLogId: string;
      safetyWithdrawalId: string | null;
      reusedExistingCase: boolean;
    }[] = res.body.data.results;
    expect(results).toHaveLength(3);
    expect(results.every((r) => r.safetyWithdrawalId !== null)).toBe(true);

    const byId = new Map(results.map((r) => [r.cattleId, r]));
    expect(byId.get(cattleA)?.reusedExistingCase).toBe(false);
    expect(byId.get(cattleB)?.reusedExistingCase).toBe(false);
    expect(byId.get(cattleC)?.reusedExistingCase).toBe(true);

    const preExisting = await prisma.healthCase.findFirst({
      where: {
        farmId: owner.farmId,
        cattleId: cattleC,
        diagnosis: 'Pre-existing case',
      },
    });
    expect(byId.get(cattleC)?.healthCaseId).toBe(preExisting?.id);

    const logs = await prisma.treatmentLog.findMany({
      where: {
        farmId: owner.farmId,
        cattleId: { in: [cattleA, cattleB, cattleC] },
        medicineId,
      },
    });
    expect(logs).toHaveLength(3);

    const withdrawals = await prisma.safetyWithdrawal.findMany({
      where: {
        farmId: owner.farmId,
        cattleId: { in: [cattleA, cattleB, cattleC] },
        medicineId,
      },
    });
    expect(withdrawals).toHaveLength(3);
    for (const w of withdrawals) {
      expect(w.milkWithdrawalUntil).not.toBeNull();
      expect(w.meatWithdrawalUntil).not.toBeNull();
    }

    const movements = await prisma.medicineStockMovement.count({
      where: { farmId: owner.farmId, medicineId, reason: 'TREATMENT' },
    });
    expect(movements).toBe(3);

    const stockAfter = await prisma.medicine.findUniqueOrThrow({
      where: { id: medicineId },
      select: { currentStock: true },
    });
    expect(stockAfter.currentStock).toBe(stockBefore.currentStock - 30); // 10ml x 3 animals
  });

  it('a medicine with 0/0 withdrawal days produces no hold', async () => {
    const freshCow = await prisma.cattle
      .create({
        data: {
          farmId: owner.farmId,
          tagNumber: `E2E-RAKHAL416-NOWD-${Date.now()}`,
          gender: 'FEMALE',
          createdBy: ownerUserId,
        },
      })
      .then((c) => c.id);

    const res = await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send({
        cattleIds: [freshCow],
        medicineId: noWithdrawalMedicineId,
        doseAmount: 5,
        doseUnit: 'ml',
        route: 'IM',
        treatedAt: new Date().toISOString(),
        financialAccountId,
      });

    expect(res.status).toBe(201);
    expect(res.body.data.results[0].safetyWithdrawalId).toBeNull();

    const withdrawal = await prisma.safetyWithdrawal.findFirst({
      where: { farmId: owner.farmId, cattleId: freshCow },
    });
    expect(withdrawal).toBeNull();
  });

  it('a bad cattleId fails the whole call with nothing written', async () => {
    const before = await prisma.treatmentLog.count({
      where: { farmId: owner.farmId, medicineId },
    });

    const res = await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send({
        cattleIds: ['not-a-real-cattle-id'],
        medicineId,
        doseAmount: 5,
        doseUnit: 'ml',
        route: 'IM',
        treatedAt: new Date().toISOString(),
      });

    expect(res.status).toBe(404);

    const after = await prisma.treatmentLog.count({
      where: { farmId: owner.farmId, medicineId },
    });
    expect(after).toBe(before);
  });

  it('rejects an unknown medicineId', async () => {
    const res = await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send({
        cattleIds: [cattleA],
        medicineId: 'not-a-real-medicine-id',
        doseAmount: 5,
        doseUnit: 'ml',
        route: 'IM',
        treatedAt: new Date().toISOString(),
      });

    expect(res.status).toBe(404);
  });
});
