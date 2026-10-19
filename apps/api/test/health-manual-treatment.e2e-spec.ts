import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { seededCashAccountId } from './utils/finance';

/**
 * Log Treatment (case-scoped) — a medicine typed by hand (`outsideInventory`)
 * touches no stock and posts no medicine cost, and an optional `vetCost` posts
 * its own cash HEALTH expense from `financialAccountId`, reversed on void.
 */
describe('Health — manual medicine name + vet cost on Log Treatment', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let financialAccountId: string;
  let inventoryMedicineId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const makeCase = async (tag: string) => {
    const cattle = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: tag,
        gender: 'FEMALE',
        createdBy: ownerUserId,
      },
    });
    const res = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId: cattle.id,
        note: 'E2E manual treatment',
        careType: 'CURATIVE',
        priority: 'LOW',
      });
    expect(res.status).toBe(201);
    return res.body.data.id as string;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const ownerUser = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = ownerUser.id;
    financialAccountId = await seededCashAccountId(ctx, owner);

    const unit = await prisma.unit.findFirstOrThrow({
      where: { farmId: null, symbol: 'mL' },
    });
    inventoryMedicineId = await prisma.medicine
      .create({
        data: {
          farmId: owner.farmId,
          name: `E2E-MANUAL-Med-${Date.now()}`,
          type: 'INJECTABLE',
          category: 'ANTIBIOTIC',
          unitId: unit.id,
          currentStock: 1000,
          costPerUnit: 20,
          purchaseDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 365 * 86_400_000).toISOString(),
          milkWithdrawalDays: 0,
          meatWithdrawalDays: 0,
          createdBy: ownerUserId,
        },
      })
      .then((m) => m.id);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('stores a hand-typed medicine by name with no stock deducted and no medicine cost', async () => {
    const caseId = await makeCase(`E2E-MANUAL-A-${Date.now()}`);
    const name = `Herbal mix ${Date.now()}`;

    const res = await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({
        medicineName: name,
        outsideInventory: true,
        doseAmount: 5,
        doseUnit: 'mL',
        route: 'ORAL',
      });
    expect(res.status).toBe(201);

    const log = await prisma.treatmentLog.findUniqueOrThrow({
      where: { id: res.body.data.treatmentLog.id },
    });
    expect(log.medicineName).toBe(name);
    expect(log.medicineId).toBeNull();
    expect(log.stockDeducted).toBe(false);
    expect(log.financeTransactionId).toBeNull();
    expect(log.vetCost).toBeNull();
    expect(log.vetExpenseId).toBeNull();
  });

  it('does not match an inventory medicine of the same name when outsideInventory is set', async () => {
    const caseId = await makeCase(`E2E-MANUAL-B-${Date.now()}`);
    const med = await prisma.medicine.findUniqueOrThrow({
      where: { id: inventoryMedicineId },
    });

    const res = await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({
        medicineName: med.name,
        outsideInventory: true,
        doseAmount: 10,
        doseUnit: 'mL',
        route: 'IM',
      });
    expect(res.status).toBe(201);

    const after = await prisma.medicine.findUniqueOrThrow({
      where: { id: inventoryMedicineId },
    });
    expect(after.currentStock).toBe(med.currentStock);
  });

  it('rejects outsideInventory without a medicine name', async () => {
    const caseId = await makeCase(`E2E-MANUAL-C-${Date.now()}`);
    const res = await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({ outsideInventory: true, doseAmount: 1, route: 'IM' });
    expect(res.status).toBe(400);
  });

  it("a vet cost with no account is paid from the farm's single account", async () => {
    const caseId = await makeCase(`E2E-MANUAL-D-${Date.now()}`);
    const res = await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({
        medicineName: 'Vet visit',
        outsideInventory: true,
        doseAmount: 1,
        route: 'IM',
        vetCost: 500,
      });
    expect(res.status).toBe(201);
    const log = await prisma.treatmentLog.findFirstOrThrow({
      where: { healthCaseId: caseId },
    });
    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: log.vetExpenseId! },
    });
    expect(expense.financialAccountId).not.toBeNull();
  });

  it('posts the vet cost as a cash HEALTH expense paid from the chosen account', async () => {
    const caseId = await makeCase(`E2E-MANUAL-E-${Date.now()}`);
    const res = await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({
        medicineName: 'Local herbal mix',
        outsideInventory: true,
        doseAmount: 1,
        route: 'ORAL',
        vetCost: 500,
        financialAccountId,
      });
    expect(res.status).toBe(201);

    const log = await prisma.treatmentLog.findUniqueOrThrow({
      where: { id: res.body.data.treatmentLog.id },
    });
    expect(Number(log.vetCost)).toBe(500);
    expect(log.vetExpenseId).not.toBeNull();
    // The medicine itself is outside inventory: no consumption expense.
    expect(log.financeTransactionId).toBeNull();

    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: log.vetExpenseId! },
    });
    expect(expense.category).toBe('HEALTH');
    expect(Number(expense.amount)).toBe(500);
    expect(expense.financialAccountId).toBe(financialAccountId);
    expect(expense.cattleId).toBe(log.cattleId);
  });

  it('keeps medicine cost and vet cost as two separate expenses for an inventory medicine', async () => {
    const caseId = await makeCase(`E2E-MANUAL-F-${Date.now()}`);
    const res = await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({
        medicineId: inventoryMedicineId,
        doseAmount: 2, // 2mL x ৳20 = ৳40
        doseUnit: 'mL',
        route: 'IM',
        vetCost: 300,
        financialAccountId,
      });
    expect(res.status).toBe(201);

    const log = await prisma.treatmentLog.findUniqueOrThrow({
      where: { id: res.body.data.treatmentLog.id },
    });
    expect(log.financeTransactionId).not.toBeNull();
    expect(log.vetExpenseId).not.toBeNull();
    expect(log.financeTransactionId).not.toBe(log.vetExpenseId);

    const medicineExpense = await prisma.expense.findUniqueOrThrow({
      where: { id: log.financeTransactionId! },
    });
    const vetExpense = await prisma.expense.findUniqueOrThrow({
      where: { id: log.vetExpenseId! },
    });
    expect(Number(medicineExpense.amount)).toBe(40);
    expect(medicineExpense.financialAccountId).toBeNull();
    expect(Number(vetExpense.amount)).toBe(300);
    expect(vetExpense.financialAccountId).toBe(financialAccountId);
  });

  it('Quick Treat: a hand-typed medicine for two animals deducts nothing and posts one vet fee', async () => {
    const mk = (tag: string) =>
      prisma.cattle
        .create({
          data: {
            farmId: owner.farmId,
            tagNumber: tag,
            gender: 'FEMALE',
            createdBy: ownerUserId,
          },
        })
        .then((c) => c.id);
    const a = await mk(`E2E-MANUAL-QA-${Date.now()}`);
    const b = await mk(`E2E-MANUAL-QB-${Date.now()}`);
    const before = await prisma.medicine.findUniqueOrThrow({
      where: { id: inventoryMedicineId },
    });

    const res = await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send({
        cattleIds: [a, b],
        outsideInventory: true,
        medicineName: 'Local herbal mix',
        doseAmount: 5,
        doseUnit: 'mL',
        route: 'ORAL',
        treatedAt: new Date().toISOString(),
        vetCost: 400,
        financialAccountId,
      });
    expect(res.status).toBe(201);

    const logs = await prisma.treatmentLog.findMany({
      where: { cattleId: { in: [a, b] } },
    });
    expect(logs).toHaveLength(2);
    expect(logs.every((l) => l.medicineName === 'Local herbal mix')).toBe(true);
    expect(logs.every((l) => !l.stockDeducted && !l.medicineId)).toBe(true);
    const withVet = logs.filter((l) => l.vetExpenseId);
    expect(withVet).toHaveLength(1);
    expect(Number(withVet[0].vetCost)).toBe(400);

    const after = await prisma.medicine.findUniqueOrThrow({
      where: { id: inventoryMedicineId },
    });
    expect(after.currentStock).toBe(before.currentStock);
  });

  it('Quick Treat: still requires medicineId for an inventory medicine; a vet fee needs no account', async () => {
    const c = await prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-MANUAL-QC-${Date.now()}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
      },
    });
    const base = {
      cattleIds: [c.id],
      doseAmount: 1,
      doseUnit: 'mL',
      route: 'IM',
      treatedAt: new Date().toISOString(),
    };
    const noMedicine = await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send(base);
    expect(noMedicine.status).toBe(400);

    const noAccount = await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send({
        ...base,
        outsideInventory: true,
        medicineName: 'Herbal',
        vetCost: 100,
      });
    expect(noAccount.status).toBe(201);
  });

  it('voiding the treatment reverses the vet expense too', async () => {
    const caseId = await makeCase(`E2E-MANUAL-G-${Date.now()}`);
    const res = await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({
        medicineName: 'Local herbal mix',
        outsideInventory: true,
        doseAmount: 1,
        route: 'ORAL',
        vetCost: 250,
        financialAccountId,
      });
    expect(res.status).toBe(201);
    const logId = res.body.data.treatmentLog.id as string;
    const vetExpenseId = (
      await prisma.treatmentLog.findUniqueOrThrow({ where: { id: logId } })
    ).vetExpenseId!;

    const voided = await request(server())
      .post(api(`/health/treatments/${logId}/void`))
      .set(...auth(owner))
      .send({ reason: 'entered by mistake' });
    expect(voided.status).toBe(200);

    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: vetExpenseId },
    });
    expect(expense.voidedAt).not.toBeNull();
  });
});
