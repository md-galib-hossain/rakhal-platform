import request from 'supertest';
import { PrismaService } from '../src/core/database/prisma/prisma.service';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-330 — breeding-event cost -> Finance link + payment source.
 * Covers: mandatory cost validation (batch cost / manual serviceCost),
 * mandatory paymentMethod whenever a real cost is posted, the actual
 * V2 `Expense` posted (RAKHAL-354 — migrated off V1 `FinanceTransaction`,
 * see `reproduction.service.ts`'s own doc comment for the full reasoning),
 * its cattle-scoped P&L bucket, and reverse+repost on edit. Requires the dev
 * stack up + `pnpm seed` (the demo farm's seeded "Cash"/"Bank" financial
 * accounts, `prisma/seed.ts#seedDemoFinance`).
 */
describe('Reproduction — AI/breeding cost -> Finance (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let cashAccountId: string;
  let bankAccountId: string;

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
    // RAKHAL-393 (closes RD-066): a breeding cost > 0 now needs a real
    // `financialAccountId`, not just `paymentMethod` — RD-097.
    const cash = await prisma.financialAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, type: 'CASH', deletedAt: null },
      select: { id: true },
    });
    cashAccountId = cash.id;
    const bank = await prisma.financialAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, type: 'BANK', deletedAt: null },
      select: { id: true },
    });
    bankAccountId = bank.id;
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  async function createCow(prefix: string) {
    return prisma.cattle.create({
      data: {
        farmId: owner.farmId,
        tagNumber: `E2E-AICOST-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        gender: 'FEMALE',
        createdBy: ownerUserId,
      },
    });
  }

  async function createSemenBatch(prefix: string, costPerUnit: number | null) {
    return prisma.semenBatch.create({
      data: {
        farmId: owner.farmId,
        name: `E2E-AICOST-BATCH-${prefix}-${Date.now()}`,
        strawQuantity: 10,
        costPerUnit: costPerUnit ?? undefined,
        createdBy: ownerUserId,
      },
    });
  }

  async function createServiceProvider(prefix: string) {
    return prisma.serviceProvider.create({
      data: {
        farmId: owner.farmId,
        name: `E2E AI Technician ${prefix} ${Date.now()}`,
        type: 'AI_TECHNICIAN',
      },
    });
  }

  it('FARM_INVENTORY AI posts a V2 Expense from the batch cost, visible on the cow finance tab', async () => {
    const cow = await createCow('INV-POST');
    const batch = await createSemenBatch('INV-POST', 450);

    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'FARM_INVENTORY',
        semenBatchId: batch.id,
        paymentMethod: 'CASH',
        financialAccountId: cashAccountId,
      })
      .expect(201);
    expect(res.body.data.financeTransactionId).toBeTruthy();
    expect(res.body.data.paymentMethod).toBe('CASH');

    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: res.body.data.financeTransactionId },
    });
    expect(Number(expense.amount)).toBe(450);
    expect(expense.category).toBe('BREEDING');
    expect(expense.cattleId).toBe(cow.id);

    const finance = await request(server())
      .get(api(`/cattle/${cow.id}/finance`))
      .set(...auth(owner))
      .expect(200);
    expect(finance.body.data.expense_breakdown.breeding).toBeGreaterThanOrEqual(
      450,
    );
  });

  it('FARM_INVENTORY AI against a batch with no cost set is rejected, straw not decremented', async () => {
    const cow = await createCow('INV-NOCOST');
    const batch = await createSemenBatch('INV-NOCOST', null);

    await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'FARM_INVENTORY',
        semenBatchId: batch.id,
        paymentMethod: 'CASH',
      })
      .expect(400);

    const batchAfter = await prisma.semenBatch.findUniqueOrThrow({
      where: { id: batch.id },
    });
    expect(batchAfter.strawQuantity).toBe(10);
  });

  it('TECHNICIAN_SUPPLIED AI without serviceCost is rejected', async () => {
    const cow = await createCow('TECH-NOCOST');
    const provider = await createServiceProvider('NOCOST');

    await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        paymentMethod: 'CASH',
      })
      .expect(400);
  });

  it("a resolved cost with no wallet or paymentMethod posts from the farm's single account", async () => {
    const cow = await createCow('NOPAY');
    const provider = await createServiceProvider('NOPAY');

    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        serviceCost: 700,
      })
      .expect(201);
    expect(res.body.data.financeTransactionId).not.toBeNull();
  });

  it('TECHNICIAN_SUPPLIED AI with serviceCost + BANK_TRANSFER posts a real V2 Expense against the Bank account', async () => {
    const cow = await createCow('TECH-BANK');
    const provider = await createServiceProvider('BANK');

    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        serviceCost: 700,
        paymentMethod: 'BANK_TRANSFER',
        financialAccountId: bankAccountId,
      })
      .expect(201);

    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: res.body.data.financeTransactionId },
    });
    expect(Number(expense.amount)).toBe(700);
    const account = await prisma.financialAccount.findUniqueOrThrow({
      where: { id: expense.financialAccountId! },
    });
    expect(account.type).toBe('BANK');
  });

  // RAKHAL-354: `FinancePaymentMethod.WALLET` is deleted in Finance V2
  // (`FINANCE_V2_DESIGN.md` §3 — "paying from the wallet" becomes paying
  // from a specific `FinancialAccount`) — `resolveFinancialAccountId`
  // (`src/common/finance/resolve-account.ts`) rejects it explicitly rather
  // than silently miscasting.
  it('WALLET is rejected — deleted in Finance V2, no account to resolve it to', async () => {
    const cow = await createCow('TECH-WALLET-REJECT');
    const provider = await createServiceProvider('WALLET-REJECT');

    await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        serviceCost: 700,
        paymentMethod: 'WALLET',
      })
      .expect(400);
  });

  it('NATURAL breeding with no serviceCost succeeds and posts nothing to Finance', async () => {
    const cow = await createCow('NATURAL-FREE');

    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'NATURAL',
      })
      .expect(201);
    expect(res.body.data.financeTransactionId).toBeNull();
  });

  it('NATURAL breeding with a serviceCost posts a transaction', async () => {
    const cow = await createCow('NATURAL-PAID');

    const res = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'NATURAL',
        serviceCost: 300,
        paymentMethod: 'BANK_TRANSFER',
        financialAccountId: bankAccountId,
      })
      .expect(201);
    expect(res.body.data.financeTransactionId).toBeTruthy();

    const expense = await prisma.expense.findUniqueOrThrow({
      where: { id: res.body.data.financeTransactionId },
    });
    expect(Number(expense.amount)).toBe(300);
    expect(expense.category).toBe('BREEDING');
  });

  it('editing serviceCost voids the old transaction and posts a new one, without doubling the cow total', async () => {
    const cow = await createCow('EDIT-COST');
    const provider = await createServiceProvider('EDIT-COST');

    const created = await request(server())
      .post(api('/reproduction/breeding-events'))
      .set(...auth(owner))
      .send({
        cattleId: cow.id,
        breedingDate: new Date().toISOString(),
        breedingMethod: 'AI',
        semenSource: 'TECHNICIAN_SUPPLIED',
        serviceProviderId: provider.id,
        serviceCost: 600,
        paymentMethod: 'CASH',
        financialAccountId: cashAccountId,
      })
      .expect(201);
    const id = created.body.data.id;
    const firstTxnId = created.body.data.financeTransactionId;
    expect(firstTxnId).toBeTruthy();

    const edited = await request(server())
      .patch(api(`/reproduction/breeding-events/${id}`))
      .set(...auth(owner))
      .send({ serviceCost: 900, financialAccountId: cashAccountId })
      .expect(200);
    const secondTxnId = edited.body.data.financeTransactionId;
    expect(secondTxnId).toBeTruthy();
    expect(secondTxnId).not.toBe(firstTxnId);

    // RAKHAL-354: `financeTransactionId` now holds an `Expense.id`, not a
    // `FinanceTransaction.id`. "Voided" is now "its journal posting has a
    // reversal" (`ExpenseService.reverseExpense`) — the `Expense`/`Payable`
    // rows themselves are never deleted or flagged, only the ledger effect
    // is mirrored to zero (`JournalService.reverseJournal`'s own invariant).
    const firstJournalTxn = await prisma.journalTransaction.findFirstOrThrow({
      where: {
        farmId: owner.farmId,
        sourceType: 'EXPENSE',
        sourceId: firstTxnId,
      },
    });
    const firstReversal = await prisma.journalTransaction.findFirst({
      where: { farmId: owner.farmId, reversalOfId: firstJournalTxn.id },
    });
    expect(firstReversal).not.toBeNull();

    const secondExpense = await prisma.expense.findUniqueOrThrow({
      where: { id: secondTxnId },
    });
    expect(Number(secondExpense.amount)).toBe(900);
    const secondJournalTxn = await prisma.journalTransaction.findFirstOrThrow({
      where: {
        farmId: owner.farmId,
        sourceType: 'EXPENSE',
        sourceId: secondTxnId,
      },
    });
    const secondReversal = await prisma.journalTransaction.findFirst({
      where: { farmId: owner.farmId, reversalOfId: secondJournalTxn.id },
    });
    expect(secondReversal).toBeNull();

    const finance = await request(server())
      .get(api(`/cattle/${cow.id}/finance`))
      .set(...auth(owner))
      .expect(200);
    // Voided reversal (-600) + new (+900) nets to the original 600 cancelled
    // out, leaving only the 900 — never 600+900=1500 (that would mean the
    // old transaction was never actually voided).
    expect(finance.body.data.expense_breakdown.breeding).toBe(900);
  });
});
