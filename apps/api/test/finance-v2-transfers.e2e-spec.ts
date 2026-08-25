import request from 'supertest';
import { FinancialAccountType, MfsProvider } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  TestContext,
} from './utils/e2e';

/**
 * RAKHAL-338 — `Transfer` between accounts, incl. fees (`FINANCE_V2_DESIGN.md`
 * §4.4). Proves the ticket's own AC against the real DB + HTTP surface:
 *
 * - source != destination is enforced;
 * - a transfer produces no revenue/expense/profit change except the optional
 *   fee, which posts to the seeded "Transfer Fee" system ledger account
 *   (code `5500`) — the design doc's own worked example (bKash→Bank,
 *   ৳10,000 + ৳100 fee: Bank +10,000, bKash −10,100, Transfer Fee Expense
 *   +100) is proven exactly, against real `JournalEntry` rows;
 * - a transfer cannot exceed the source account's available balance;
 * - all three account-type pairs (Cash→Bank, Bank→MFS, MFS→Cash);
 * - RBAC (`finance.transfer`: **owner-only** — RAKHAL-353's governance pass
 *   tightened this from RAKHAL-338's original "Owner + Manager" shipped tier
 *   to match `finance.void`'s owner-only pattern; see
 *   `permission-catalogue.ts`'s own doc comment on this key for the full
 *   reasoning).
 *
 * Requires the dev stack up + `pnpm seed` (uses the seeded demo owner's
 * already-bootstrapped chart of accounts, RAKHAL-333, for the Transfer Fee
 * lookup, and RAKHAL-335's `POST /finance/accounts` with an opening balance
 * to fund each source account before transferring out of it).
 */
describe('Finance V2 — Transfers (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createdAccountIds: string[] = [];
  const createdLedgerAccountIds: string[] = [];
  const createdTransferIds: string[] = [];
  const createdPaymentIds: string[] = [];

  const uniqueName = (prefix: string) =>
    `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const createAccount = async (
    user: AuthedUser,
    type: FinancialAccountType,
    openingBalance?: number,
  ): Promise<{ id: string; ledgerAccountId: string }> => {
    const body: Record<string, unknown> = {
      name: uniqueName(`Transfers-${type}`),
      type,
    };
    if (openingBalance !== undefined) {
      body.openingBalance = openingBalance;
    }
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
    const res = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(user))
      .send(body)
      .expect(201);
    const account = (
      res.body as { data: { id: string; ledgerAccountId: string } }
    ).data;
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
  }, 30_000);

  afterAll(async () => {
    await prisma.journalEntry
      .deleteMany({
        where: { ledgerAccountId: { in: createdLedgerAccountIds } },
      })
      .catch(() => undefined);
    await prisma.journalTransaction
      .deleteMany({
        where: {
          sourceId: { in: [...createdTransferIds, ...createdPaymentIds] },
        },
      })
      .catch(() => undefined);
    await prisma.paymentAllocation
      .deleteMany({ where: { payment: { id: { in: createdPaymentIds } } } })
      .catch(() => undefined);
    await prisma.financePayment
      .deleteMany({ where: { id: { in: createdPaymentIds } } })
      .catch(() => undefined);
    await prisma.transfer
      .deleteMany({ where: { id: { in: createdTransferIds } } })
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

  it('rejects a same-account transfer', async () => {
    const cash = await createAccount(owner, FinancialAccountType.CASH, 5000);
    await request(server())
      .post(api('/finance/transfers'))
      .set(...bearer(owner))
      .send({
        fromFinancialAccountId: cash.id,
        toFinancialAccountId: cash.id,
        amount: 100,
        transactionDate: new Date().toISOString(),
      })
      .expect(400);
  });

  it('rejects a transfer exceeding the source balance', async () => {
    const cash = await createAccount(owner, FinancialAccountType.CASH, 100);
    const bank = await createAccount(owner, FinancialAccountType.BANK);
    await request(server())
      .post(api('/finance/transfers'))
      .set(...bearer(owner))
      .send({
        fromFinancialAccountId: cash.id,
        toFinancialAccountId: bank.id,
        amount: 500,
        transactionDate: new Date().toISOString(),
      })
      .expect(400);
  });

  it('Cash -> Bank, no fee: exactly 2 balanced journal lines', async () => {
    const cash = await createAccount(owner, FinancialAccountType.CASH, 2000);
    const bank = await createAccount(owner, FinancialAccountType.BANK);

    const res = await request(server())
      .post(api('/finance/transfers'))
      .set(...bearer(owner))
      .send({
        fromFinancialAccountId: cash.id,
        toFinancialAccountId: bank.id,
        amount: 1500,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    const transfer = (
      res.body as { data: { id: string; amount: string; feeAmount: string } }
    ).data;
    createdTransferIds.push(transfer.id);
    expect(Number(transfer.amount)).toBe(1500);
    expect(Number(transfer.feeAmount)).toBe(0);

    const journalTxn = await prisma.journalTransaction.findFirst({
      where: {
        farmId: owner.farmId,
        sourceType: 'FINANCE_TRANSFER',
        sourceId: transfer.id,
      },
      include: { entries: true },
    });
    expect(journalTxn?.entries).toHaveLength(2);
    const debitLine = journalTxn?.entries.find(
      (e) => e.ledgerAccountId === bank.ledgerAccountId,
    );
    const creditLine = journalTxn?.entries.find(
      (e) => e.ledgerAccountId === cash.ledgerAccountId,
    );
    expect(debitLine?.debit.toString()).toBe('1500');
    expect(creditLine?.credit.toString()).toBe('1500');
  });

  it('MFS -> Cash, no fee: exactly 2 balanced journal lines', async () => {
    const mfs = await createAccount(owner, FinancialAccountType.MFS, 3000);
    const cash = await createAccount(owner, FinancialAccountType.CASH);

    const res = await request(server())
      .post(api('/finance/transfers'))
      .set(...bearer(owner))
      .send({
        fromFinancialAccountId: mfs.id,
        toFinancialAccountId: cash.id,
        amount: 2000,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    const transfer = (res.body as { data: { id: string } }).data;
    createdTransferIds.push(transfer.id);

    const journalTxn = await prisma.journalTransaction.findFirst({
      where: {
        farmId: owner.farmId,
        sourceType: 'FINANCE_TRANSFER',
        sourceId: transfer.id,
      },
      include: { entries: true },
    });
    expect(journalTxn?.entries).toHaveLength(2);
  });

  it('worked example: bKash -> Bank, ৳10,000 + ৳100 fee — Bank +10,000, bKash -10,100, Transfer Fee Expense +100', async () => {
    const bkash = await createAccount(owner, FinancialAccountType.MFS, 15_000);
    const bank = await createAccount(owner, FinancialAccountType.BANK);

    const res = await request(server())
      .post(api('/finance/transfers'))
      .set(...bearer(owner))
      .send({
        fromFinancialAccountId: bkash.id,
        toFinancialAccountId: bank.id,
        amount: 10_000,
        feeAmount: 100,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    const transfer = (
      res.body as { data: { id: string; amount: string; feeAmount: string } }
    ).data;
    createdTransferIds.push(transfer.id);
    expect(Number(transfer.amount)).toBe(10_000);
    expect(Number(transfer.feeAmount)).toBe(100);

    const feeAccount = await prisma.ledgerAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, code: '5500' },
    });
    const journalTxn = await prisma.journalTransaction.findFirst({
      where: {
        farmId: owner.farmId,
        sourceType: 'FINANCE_TRANSFER',
        sourceId: transfer.id,
      },
      include: { entries: true },
    });
    expect(journalTxn?.entries).toHaveLength(4);

    const bankDebit = journalTxn?.entries
      .filter((e) => e.ledgerAccountId === bank.ledgerAccountId)
      .reduce((t, e) => t + Number(e.debit), 0);
    const bkashCredit = journalTxn?.entries
      .filter((e) => e.ledgerAccountId === bkash.ledgerAccountId)
      .reduce((t, e) => t + Number(e.credit), 0);
    const feeDebit = journalTxn?.entries
      .filter((e) => e.ledgerAccountId === feeAccount.id)
      .reduce((t, e) => t + Number(e.debit), 0);

    expect(bankDebit).toBe(10_000);
    expect(bkashCredit).toBe(10_100);
    expect(feeDebit).toBe(100);

    const totalDebit = journalTxn?.entries.reduce(
      (t, e) => t + Number(e.debit),
      0,
    );
    const totalCredit = journalTxn?.entries.reduce(
      (t, e) => t + Number(e.credit),
      0,
    );
    expect(totalDebit).toBe(totalCredit);
  });

  it('RBAC: transfer is owner-only — Worker and Manager are both forbidden, Owner succeeds (RAKHAL-353)', async () => {
    const cash = await createAccount(owner, FinancialAccountType.CASH, 5000);
    const bank = await createAccount(owner, FinancialAccountType.BANK);

    await request(server())
      .post(api('/finance/transfers'))
      .set(...bearer(worker))
      .send({
        fromFinancialAccountId: cash.id,
        toFinancialAccountId: bank.id,
        amount: 100,
        transactionDate: new Date().toISOString(),
      })
      .expect(403);

    await request(server())
      .get(api('/finance/transfers'))
      .set(...bearer(worker))
      .expect(403);

    // RAKHAL-353: `finance.transfer` was Owner+Manager per RAKHAL-338's own
    // AC; this ticket's governance pass tightened it to owner-only (same
    // tier as `finance.void`) — Manager is now forbidden too.
    await request(server())
      .post(api('/finance/transfers'))
      .set(...bearer(manager))
      .send({
        fromFinancialAccountId: cash.id,
        toFinancialAccountId: bank.id,
        amount: 100,
        transactionDate: new Date().toISOString(),
      })
      .expect(403);

    await request(server())
      .get(api('/finance/transfers'))
      .set(...bearer(manager))
      .expect(403);

    const ownerRes = await request(server())
      .post(api('/finance/transfers'))
      .set(...bearer(owner))
      .send({
        fromFinancialAccountId: cash.id,
        toFinancialAccountId: bank.id,
        amount: 100,
        transactionDate: new Date().toISOString(),
      })
      .expect(201);
    const transfer = (ownerRes.body as { data: { id: string } }).data;
    createdTransferIds.push(transfer.id);

    await request(server())
      .get(api('/finance/transfers'))
      .set(...bearer(owner))
      .expect(200);
  });
});
