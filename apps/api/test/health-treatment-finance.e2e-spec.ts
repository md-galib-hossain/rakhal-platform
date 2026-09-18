import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';
import { seededCashAccountId } from './utils/finance';

/**
 * RAKHAL-419 — treatment cost posts to Finance. Logging a treatment with a
 * priced medicine posts an `Expense` (`category: HEALTH`, ledger `5100
 * Medicine`) valued at `costPerUnit × doseAmount`; a zero-cost medicine
 * posts nothing; the dashboard's `medicineExpense` and
 * `GET /cattle/:id/finance`'s `health` bucket both reflect the real sum,
 * replacing the old hardcoded `0`.
 *
 * RD-084 (2026-09-18): `financialAccountId` is no longer required or read —
 * the medicine's cost already left the farm once, at
 * `PurchaseService.createPurchase` time; re-crediting a cash account here
 * double-counted the same rupees and never shrank the Inventory asset.
 * Consumption now posts `Dr HEALTH(5100) / Cr Inventory(1200)`
 * (`ExpenseService.recordInventoryConsumption`) — a same-farm transfer, the
 * `Expense.financialAccountId` column stays `null`.
 */
describe('Health — treatment cost posts to Finance (RAKHAL-419)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let financialAccountId: string;
  let pricedMedicineId: string;
  let freeMedicineId: string;

  const auth = (u: AuthedUser): [string, string] => [
    'Authorization',
    `Bearer ${u.token}`,
  ];
  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const makeCow = async (tag: string) =>
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
    const stamp = Date.now();

    const makeMedicine = (costPerUnit: number) =>
      prisma.medicine
        .create({
          data: {
            farmId: owner.farmId,
            name: `E2E-RAKHAL419-Med-${stamp}-${Math.random().toString(36).slice(2, 5)}`,
            type: 'INJECTABLE',
            category: 'ANTIBIOTIC',
            unitId: unit.id,
            currentStock: 1000,
            costPerUnit,
            purchaseDate: new Date().toISOString(),
            expiryDate: new Date(Date.now() + 365 * 86_400_000).toISOString(),
            milkWithdrawalDays: 0,
            meatWithdrawalDays: 0,
            createdBy: ownerUserId,
          },
        })
        .then((m) => m.id);
    pricedMedicineId = await makeMedicine(20); // ৳20/mL
    freeMedicineId = await makeMedicine(0);
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  it('posts an Expense (category HEALTH, ledger 5100) valued at costPerUnit × doseAmount', async () => {
    const cattleId = await makeCow(`E2E-RAKHAL419-A-${Date.now()}`);

    const res = await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send({
        cattleIds: [cattleId],
        medicineId: pricedMedicineId,
        doseAmount: 10, // 10mL x ৳20 = ৳200
        doseUnit: 'mL',
        route: 'IM',
        treatedAt: new Date().toISOString(),
        financialAccountId,
      });

    expect(res.status).toBe(201);
    const treatmentLogId = res.body.data.results[0].treatmentLogId as string;

    const log = await prisma.treatmentLog.findUniqueOrThrow({
      where: { id: treatmentLogId },
    });
    expect(log.financeTransactionId).not.toBeNull();

    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: log.financeTransactionId! },
    });
    expect(expense.category).toBe('HEALTH');
    expect(Number(expense.amount)).toBe(200);
    expect(expense.cattleId).toBe(cattleId);
    // RD-084: never a cash event — no FinancialAccount involved.
    expect(expense.financialAccountId).toBeNull();

    const journalTxn = await prisma.journalTransaction.findFirstOrThrow({
      where: {
        farmId: owner.farmId,
        sourceType: 'EXPENSE',
        sourceId: expense.id,
      },
      include: { entries: { include: { ledgerAccount: true } } },
    });
    const debitEntry = journalTxn.entries.find((e) => Number(e.debit) > 0);
    expect(debitEntry?.ledgerAccount.code).toBe('5100');
    // RD-084: the credit leg is Inventory(1200), not the cash account
    // passed above — proves `financialAccountId` is truly unread.
    const creditEntry = journalTxn.entries.find((e) => Number(e.credit) > 0);
    expect(creditEntry?.ledgerAccount.code).toBe('1200');
  });

  it('RD-084: no longer requires financialAccountId — a real cost still posts, as an inventory transfer', async () => {
    const cattleId = await makeCow(`E2E-RAKHAL419-B-${Date.now()}`);

    const res = await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send({
        cattleIds: [cattleId],
        medicineId: pricedMedicineId,
        doseAmount: 5, // 5mL x ৳20 = ৳100
        doseUnit: 'mL',
        route: 'IM',
        treatedAt: new Date().toISOString(),
        // financialAccountId omitted — must not be required (RD-084)
      });

    expect(res.status).toBe(201);
    const treatmentLogId = res.body.data.results[0].treatmentLogId as string;

    const log = await prisma.treatmentLog.findUniqueOrThrow({
      where: { id: treatmentLogId },
    });
    expect(log.financeTransactionId).not.toBeNull();

    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: log.financeTransactionId! },
    });
    expect(Number(expense.amount)).toBe(100);
    expect(expense.financialAccountId).toBeNull();
  });

  it('a zero-cost medicine posts nothing and needs no account', async () => {
    const cattleId = await makeCow(`E2E-RAKHAL419-C-${Date.now()}`);

    const res = await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send({
        cattleIds: [cattleId],
        medicineId: freeMedicineId,
        doseAmount: 5,
        doseUnit: 'mL',
        route: 'IM',
        treatedAt: new Date().toISOString(),
        // no financialAccountId — must not be required
      });

    expect(res.status).toBe(201);
    const treatmentLogId = res.body.data.results[0].treatmentLogId as string;
    const log = await prisma.treatmentLog.findUniqueOrThrow({
      where: { id: treatmentLogId },
    });
    expect(log.financeTransactionId).toBeNull();
  });

  it('GET /health/dashboard medicineExpense reflects the real sum, not a hardcoded 0', async () => {
    const before = await request(server())
      .get(api('/health/dashboard'))
      .set(...auth(owner));
    const beforeValue = Number(before.body.data.medicineExpense);

    const cattleId = await makeCow(`E2E-RAKHAL419-D-${Date.now()}`);
    await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send({
        cattleIds: [cattleId],
        medicineId: pricedMedicineId,
        doseAmount: 3, // 3mL x ৳20 = ৳60
        doseUnit: 'mL',
        route: 'IM',
        treatedAt: new Date().toISOString(),
        financialAccountId,
      });

    const after = await request(server())
      .get(api('/health/dashboard'))
      .set(...auth(owner));
    expect(after.status).toBe(200);
    expect(Number(after.body.data.medicineExpense)).toBe(beforeValue + 60);
  });

  it('GET /cattle/:id/finance shows treatment cost in the health expense bucket', async () => {
    const cattleId = await makeCow(`E2E-RAKHAL419-E-${Date.now()}`);
    await request(server())
      .post(api('/health/treatments'))
      .set(...auth(owner))
      .send({
        cattleIds: [cattleId],
        medicineId: pricedMedicineId,
        doseAmount: 4, // 4mL x ৳20 = ৳80
        doseUnit: 'mL',
        route: 'IM',
        treatedAt: new Date().toISOString(),
        financialAccountId,
      });

    const res = await request(server())
      .get(api(`/cattle/${cattleId}/finance`))
      .set(...auth(owner));
    expect(res.status).toBe(200);
    expect(res.body.data.expense_breakdown.health).toBe(80);
    expect(res.body.data.total_cost).toBe(80);
  });

  it('logging a treatment via the case-scoped route also posts cost (report-sickness path)', async () => {
    const cattleId = await makeCow(`E2E-RAKHAL419-F-${Date.now()}`);
    const caseRes = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        note: 'E2E-RAKHAL419 case-scoped treatment',
        careType: 'CURATIVE',
        priority: 'LOW',
      });
    expect(caseRes.status).toBe(201);
    const caseId = caseRes.body.data.id as string;

    const logRes = await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({
        medicineId: pricedMedicineId,
        doseAmount: 2, // 2mL x ৳20 = ৳40
        doseUnit: 'mL',
        route: 'IM',
        financialAccountId,
      });
    expect(logRes.status).toBe(201);

    const treatmentLog = await prisma.treatmentLog.findUniqueOrThrow({
      where: { id: logRes.body.data.treatmentLog.id },
    });
    expect(treatmentLog.financeTransactionId).not.toBeNull();
    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: treatmentLog.financeTransactionId! },
    });
    expect(Number(expense.amount)).toBe(40);
    expect(expense.category).toBe('HEALTH');
  });

  it('RD-084: a case-scoped log-treatment with a real cost and no financialAccountId succeeds, decrements stock, and posts an inventory transfer', async () => {
    const cattleId = await makeCow(`E2E-RAKHAL419-G-${Date.now()}`);
    const caseRes = await request(server())
      .post(api('/health/cases'))
      .set(...auth(owner))
      .send({
        cattleId,
        note: 'E2E-RAKHAL419-RD084 no account needed',
        careType: 'CURATIVE',
        priority: 'LOW',
      });
    const caseId = caseRes.body.data.id as string;

    const before = await prisma.medicine.findUniqueOrThrow({
      where: { id: pricedMedicineId },
    });

    const logRes = await request(server())
      .post(api(`/health/cases/${caseId}/log-treatment`))
      .set(...auth(owner))
      .send({
        medicineId: pricedMedicineId,
        doseAmount: 2, // 2mL x ৳20 = ৳40
        doseUnit: 'mL',
        route: 'IM',
        // financialAccountId omitted — must not be required (RD-084)
      });
    expect(logRes.status).toBe(201);

    const after = await prisma.medicine.findUniqueOrThrow({
      where: { id: pricedMedicineId },
    });
    expect(after.currentStock).toBe(before.currentStock - 2);

    const treatmentLog = await prisma.treatmentLog.findUniqueOrThrow({
      where: { id: logRes.body.data.treatmentLog.id },
    });
    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: treatmentLog.financeTransactionId! },
    });
    expect(Number(expense.amount)).toBe(40);
    expect(expense.financialAccountId).toBeNull();
  });
});
