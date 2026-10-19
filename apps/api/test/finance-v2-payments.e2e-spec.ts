import request from 'supertest';
import {
  FinancialAccountType,
  MfsProvider,
  PaymentDirection,
  PaymentMethod,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';
import { createExtraAccount } from './utils/finance';

/**
 * RAKHAL-337 — `FinancePayment` + `PaymentAllocation` (`FINANCE_V2_DESIGN.md`
 * §4.5, §4.6). Proves the ticket's own AC against the real DB + HTTP surface:
 *
 * - a payment always hits exactly one `FinancialAccount` and posts a real
 *   balanced `JournalTransaction` (INCOMING debits the account, credits the
 *   generic Accounts Receivable system ledger account, code `1100`;
 *   OUTGOING debits Accounts Payable, code `2000`, credits the account) —
 *   the standalone-payment judgment call documented on `PaymentService`,
 *   since `Receivable`/`Payable` (RAKHAL-340/348) don't exist yet;
 * - `PaymentAllocation` cannot push a payment's allocated total past its own
 *   `amount`;
 * - the ticket's own worked example — a ৳150,000 animal sale settled by
 *   cash + bKash + bank across three separate payments — leaves the correct
 *   amount due, proven here with a **synthetic `receivableId`**
 *   (`test-receivable:<id>`, a stand-in for the real `Sale`→`Receivable`
 *   RAKHAL-339/340/345 will create) since no real Receivable exists until
 *   those tickets land; `allocatePayment` itself doesn't care what the id
 *   refers to, only that the running total per payment never exceeds that
 *   payment's own amount — exactly the seam RAKHAL-340/345 will call once a
 *   real receivable exists;
 * - RBAC (`finance.create`/`finance.read`: Owner + Manager, not Worker).
 *
 * Requires the dev stack up + `pnpm seed` (uses the seeded demo owner's
 * already-bootstrapped chart of accounts, RAKHAL-333, for the Accounts
 * Receivable/Payable lookups).
 */
describe('Finance V2 — Payments (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;
  let ownerUserId: string;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createdAccountIds: string[] = [];
  const createdLedgerAccountIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdReceivableIds: string[] = [];
  const createdSaleIds: string[] = [];

  const uniqueName = (prefix: string) =>
    `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  /**
   * RAKHAL-340: `PaymentAllocation.receivableId` is now a real FK, so these
   * tests need a real `Receivable` (and its parent `Sale`) to allocate
   * against instead of the synthetic `test-receivable:*` strings this spec
   * used before that relation existed. Created directly via Prisma (not
   * `POST /sales`) since a minimal fixture is all these payment-allocation
   * tests need — the Sales module's own HTTP surface is proven separately
   * by `test/rakhal-339-sale.e2e-spec.ts`.
   */
  const createReceivable = async (
    totalAmount: number,
  ): Promise<{ id: string; saleId: string }> => {
    const sale = await prisma.sale.create({
      data: {
        farmId: owner.farmId,
        saleNumber: uniqueName('E2E-RECV-SALE'),
        saleDate: new Date(),
        subtotal: totalAmount,
        totalAmount,
        createdById: ownerUserId,
      },
    });
    createdSaleIds.push(sale.id);
    const receivable = await prisma.receivable.create({
      data: { farmId: owner.farmId, saleId: sale.id, totalAmount },
    });
    createdReceivableIds.push(receivable.id);
    return receivable;
  };

  const createAccount = async (
    user: AuthedUser,
    type: FinancialAccountType,
  ): Promise<{ id: string; ledgerAccountId: string }> => {
    const body: Record<string, unknown> = {
      name: uniqueName(`Payments-${type}`),
      type,
    };
    if (type === FinancialAccountType.BANK) {
      body.bankDetail = {
        bankName: 'City Bank',
        accountNumber: `${Date.now()}`,
      };
    } else if (type === FinancialAccountType.MFS) {
      body.mfsDetail = {
        provider: MfsProvider.BKASH,
        phoneNumber: '01700000000',
      };
    }
    const account = await createExtraAccount(ctx, prisma, user, body);
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);
    return account;
  };

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;
  }, 30_000);

  afterAll(async () => {
    await prisma.paymentAllocation
      .deleteMany({ where: { payment: { id: { in: createdPaymentIds } } } })
      .catch(() => undefined);
    await prisma.receivable
      .deleteMany({ where: { id: { in: createdReceivableIds } } })
      .catch(() => undefined);
    await prisma.sale
      .deleteMany({ where: { id: { in: createdSaleIds } } })
      .catch(() => undefined);
    await prisma.journalEntry
      .deleteMany({
        where: { ledgerAccountId: { in: createdLedgerAccountIds } },
      })
      .catch(() => undefined);
    await prisma.journalTransaction
      .deleteMany({ where: { sourceId: { in: createdPaymentIds } } })
      .catch(() => undefined);
    await prisma.financePayment
      .deleteMany({ where: { id: { in: createdPaymentIds } } })
      .catch(() => undefined);
    await prisma.journalTransaction
      .deleteMany({ where: { sourceId: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.bankAccountDetail
      .deleteMany({ where: { financialAccountId: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.mfsAccountDetail
      .deleteMany({ where: { financialAccountId: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.financialAccount
      .deleteMany({ where: { id: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.ledgerAccount
      .deleteMany({ where: { id: { in: createdLedgerAccountIds } } })
      .catch(() => undefined);
    await ctx.app.close();
  });

  it('records an INCOMING payment: debits the account, credits Accounts Receivable', async () => {
    const account = await createAccount(owner, FinancialAccountType.CASH);

    const res = await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: PaymentDirection.INCOMING,
        financialAccountId: account.id,
        amount: 5000,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);

    const payment = (
      res.body as {
        data: {
          id: string;
          direction: string;
          financialAccountId: string;
          amount: string;
        };
      }
    ).data;
    createdPaymentIds.push(payment.id);

    expect(payment.direction).toBe(PaymentDirection.INCOMING);
    expect(payment.financialAccountId).toBe(account.id);
    expect(Number(payment.amount)).toBe(5000);

    const arAccount = await prisma.ledgerAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, code: '1100' },
    });
    const journalTxn = await prisma.journalTransaction.findFirst({
      where: {
        farmId: owner.farmId,
        sourceType: 'FINANCE_PAYMENT',
        sourceId: payment.id,
      },
      include: { entries: true },
    });
    expect(journalTxn).not.toBeNull();
    expect(journalTxn?.entries).toHaveLength(2);
    const debitLine = journalTxn?.entries.find(
      (e) => e.ledgerAccountId === account.ledgerAccountId,
    );
    const creditLine = journalTxn?.entries.find(
      (e) => e.ledgerAccountId === arAccount.id,
    );
    expect(debitLine?.debit.toString()).toBe('5000');
    expect(creditLine?.credit.toString()).toBe('5000');
  });

  it('records an OUTGOING payment: debits Accounts Payable, credits the account', async () => {
    const account = await createAccount(owner, FinancialAccountType.BANK);

    const res = await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: PaymentDirection.OUTGOING,
        financialAccountId: account.id,
        amount: 2000,
        method: PaymentMethod.BANK_TRANSFER,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);

    const payment = (res.body as { data: { id: string } }).data;
    createdPaymentIds.push(payment.id);

    const apAccount = await prisma.ledgerAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, code: '2000' },
    });
    const journalTxn = await prisma.journalTransaction.findFirst({
      where: {
        farmId: owner.farmId,
        sourceType: 'FINANCE_PAYMENT',
        sourceId: payment.id,
      },
      include: { entries: true },
    });
    const debitLine = journalTxn?.entries.find(
      (e) => e.ledgerAccountId === apAccount.id,
    );
    const creditLine = journalTxn?.entries.find(
      (e) => e.ledgerAccountId === account.ledgerAccountId,
    );
    expect(debitLine?.debit.toString()).toBe('2000');
    expect(creditLine?.credit.toString()).toBe('2000');
  });

  it('rejects a payment against an archived financial account', async () => {
    const account = await createAccount(owner, FinancialAccountType.CASH);
    await request(server())
      .patch(api(`/finance/accounts/${account.id}/archive`))
      .set(...bearer(owner))
      .expect(200);

    await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: PaymentDirection.INCOMING,
        financialAccountId: account.id,
        amount: 100,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(400);
  });

  it('rejects a zero amount', async () => {
    const account = await createAccount(owner, FinancialAccountType.CASH);
    await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: PaymentDirection.INCOMING,
        financialAccountId: account.id,
        amount: 0,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(400);
  });

  it('allocatePayment rejects over-allocation past the payment amount', async () => {
    const account = await createAccount(owner, FinancialAccountType.CASH);
    // Receivable total (10,000) is deliberately far larger than the payment
    // (1,000) so this test proves the *payment-amount* guard specifically,
    // not the receivable-outstanding guard RAKHAL-340 adds (covered by its
    // own test below).
    const receivable = await createReceivable(10_000);
    const payRes = await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: PaymentDirection.INCOMING,
        financialAccountId: account.id,
        amount: 1000,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    const payment = (payRes.body as { data: { id: string } }).data;
    createdPaymentIds.push(payment.id);

    // First allocation within bounds.
    await request(server())
      .post(api(`/finance/payments/${payment.id}/allocations`))
      .set(...bearer(owner))
      .send({
        allocations: [{ receivableId: receivable.id, amount: 700 }],
      })
      .expect(201);

    // A second allocation that would push the total past 1000 is rejected.
    await request(server())
      .post(api(`/finance/payments/${payment.id}/allocations`))
      .set(...bearer(owner))
      .send({
        allocations: [{ receivableId: receivable.id, amount: 500 }],
      })
      .expect(400);
  });

  it('allocatePayment rejects over-allocation past the receivable outstanding amount (RAKHAL-340)', async () => {
    // The receivable's own total (4,000) is smaller than the payment
    // (5,000) — this proves the cross-payment guard `ReceivableService.
    // assertWithinOutstanding` adds, which the payment-amount guard above
    // cannot catch (5,000 allocation fits inside a 5,000 payment, but not
    // inside a 4,000 receivable).
    const account = await createAccount(owner, FinancialAccountType.CASH);
    const receivable = await createReceivable(4_000);
    const payRes = await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: PaymentDirection.INCOMING,
        financialAccountId: account.id,
        amount: 5000,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    const payment = (payRes.body as { data: { id: string } }).data;
    createdPaymentIds.push(payment.id);

    await request(server())
      .post(api(`/finance/payments/${payment.id}/allocations`))
      .set(...bearer(owner))
      .send({
        allocations: [{ receivableId: receivable.id, amount: 5000 }],
      })
      .expect(400);
  });

  it('rejects an allocation line with neither receivableId nor payableId, and one with both', async () => {
    const account = await createAccount(owner, FinancialAccountType.CASH);
    const payRes = await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(owner))
      .send({
        direction: PaymentDirection.INCOMING,
        financialAccountId: account.id,
        amount: 500,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    const payment = (payRes.body as { data: { id: string } }).data;
    createdPaymentIds.push(payment.id);

    await request(server())
      .post(api(`/finance/payments/${payment.id}/allocations`))
      .set(...bearer(owner))
      .send({ allocations: [{ amount: 100 }] })
      .expect(400);

    await request(server())
      .post(api(`/finance/payments/${payment.id}/allocations`))
      .set(...bearer(owner))
      .send({
        allocations: [
          {
            receivableId: 'test-receivable:both',
            payableId: 'test-payable:both',
            amount: 100,
          },
        ],
      })
      .expect(400);
  });

  it('worked example: a ৳150,000 animal sale settled by cash + bKash + bank across three payments leaves the correct due', async () => {
    const cash = await createAccount(owner, FinancialAccountType.CASH);
    const bkash = await createAccount(owner, FinancialAccountType.MFS);
    const bank = await createAccount(owner, FinancialAccountType.BANK);

    const saleTotal = 150_000;
    const receivable = await createReceivable(saleTotal);
    const legs: Array<{
      account: { id: string; ledgerAccountId: string };
      method: PaymentMethod;
      amount: number;
    }> = [
      { account: cash, method: PaymentMethod.CASH, amount: 50_000 },
      { account: bkash, method: PaymentMethod.MFS, amount: 50_000 },
      { account: bank, method: PaymentMethod.BANK_TRANSFER, amount: 50_000 },
    ];

    for (const leg of legs) {
      const payRes = await request(server())
        .post(api('/finance/payments'))
        .set(...bearer(owner))
        .send({
          direction: PaymentDirection.INCOMING,
          financialAccountId: leg.account.id,
          amount: leg.amount,
          method: leg.method,
          transactionDate: new Date().toISOString(),
        })
        .expect(201);
      const payment = (payRes.body as { data: { id: string } }).data;
      createdPaymentIds.push(payment.id);

      await request(server())
        .post(api(`/finance/payments/${payment.id}/allocations`))
        .set(...bearer(owner))
        .send({
          allocations: [{ receivableId: receivable.id, amount: leg.amount }],
        })
        .expect(201);
    }

    const totalAllocated = await prisma.paymentAllocation.aggregate({
      where: { receivableId: receivable.id },
      _sum: { amount: true },
    });
    const due = saleTotal - Number(totalAllocated._sum.amount ?? 0);
    expect(due).toBe(0);

    // Sanity: each leg's own account balance moved by its own journal — the
    // three payments hit three *different* accounts, never merged into one.
    const balances = await Promise.all(
      legs.map((leg) =>
        prisma.journalEntry.aggregate({
          where: { ledgerAccountId: leg.account.ledgerAccountId },
          _sum: { debit: true },
        }),
      ),
    );
    balances.forEach((b, i) => {
      expect(Number(b._sum.debit ?? 0)).toBeGreaterThanOrEqual(legs[i].amount);
    });
  });

  it('RBAC: Worker cannot record a payment or read the list; Manager can', async () => {
    const account = await createAccount(owner, FinancialAccountType.CASH);

    await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(worker))
      .send({
        direction: PaymentDirection.INCOMING,
        financialAccountId: account.id,
        amount: 100,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(403);

    await request(server())
      .get(api('/finance/payments'))
      .set(...bearer(worker))
      .expect(403);

    const managerRes = await request(server())
      .post(api('/finance/payments'))
      .set(...bearer(manager))
      .send({
        direction: PaymentDirection.INCOMING,
        financialAccountId: account.id,
        amount: 100,
        method: PaymentMethod.CASH,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    const payment = (managerRes.body as { data: { id: string } }).data;
    createdPaymentIds.push(payment.id);
  });
});
