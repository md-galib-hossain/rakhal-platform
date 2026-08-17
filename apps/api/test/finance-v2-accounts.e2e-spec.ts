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
 * RAKHAL-335 — `FinancialAccount` (Cash/Bank/MFS) + detail tables + opening
 * balances (`FINANCE_V2_DESIGN.md` §3, §4.4). Proves the ticket's own AC
 * against the real DB + HTTP surface: creating a BANK account with an opening
 * balance produces the account row, its `BankAccountDetail`, AND a real
 * balanced `JournalTransaction` (debit the account's own ledger account,
 * credit Opening Balance Equity) — never a stored balance column; archiving
 * sets `isActive:false`/`archivedAt` without deleting the row; RBAC holds
 * (`finance.accounts`: Owner + Manager, not Worker).
 *
 * Requires the dev stack up + `pnpm seed` (uses the seeded demo owner's
 * already-bootstrapped chart of accounts, RAKHAL-333, for the Opening Balance
 * Equity lookup).
 */
describe('Finance V2 — Financial Accounts (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let owner: AuthedUser;
  let manager: AuthedUser;
  let worker: AuthedUser;

  const api = (p: string): string => `${ctx.prefix}${p}`;
  const server = () => ctx.app.getHttpServer();

  const createdAccountIds: string[] = [];
  const createdLedgerAccountIds: string[] = [];

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    manager = await loginAs(ctx, 'manager@demo.rakhal.test', 'ManagerPass123');
    worker = await loginAs(ctx, 'worker@demo.rakhal.test', 'WorkerPass123');
  }, 30_000);

  afterAll(async () => {
    // Best-effort local cleanup of every account/ledger-account this spec created.
    await prisma.bankAccountDetail
      .deleteMany({ where: { financialAccountId: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.mfsAccountDetail
      .deleteMany({ where: { financialAccountId: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.journalEntry
      .deleteMany({
        where: { ledgerAccountId: { in: createdLedgerAccountIds } },
      })
      .catch(() => undefined);
    await prisma.journalTransaction
      .deleteMany({
        where: { sourceId: { in: createdAccountIds } },
      })
      .catch(() => undefined);
    await prisma.financialAccount
      .deleteMany({ where: { id: { in: createdAccountIds } } })
      .catch(() => undefined);
    await prisma.ledgerAccount
      .deleteMany({ where: { id: { in: createdLedgerAccountIds } } })
      .catch(() => undefined);
    await ctx.app.close();
  });

  const uniqueName = (prefix: string) =>
    `${prefix} ${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  it('creates a BANK account with detail + a real opening-balance journal posting (never a stored balance)', async () => {
    const name = uniqueName('BRAC Bank');

    const res = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({
        name,
        type: FinancialAccountType.BANK,
        bankDetail: {
          bankName: 'BRAC Bank',
          accountNumber: '1234567890123',
          branch: 'Gulshan',
        },
        openingBalance: 50000,
      })
      .expect(201);

    const account = (
      res.body as {
        data: {
          id: string;
          name: string;
          type: string;
          ledgerAccountId: string;
          currency: string;
          isActive: boolean;
          bankDetail: { bankName: string; accountNumber: string } | null;
          mfsDetail: unknown;
        };
      }
    ).data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);

    expect(account.name).toBe(name);
    expect(account.type).toBe(FinancialAccountType.BANK);
    expect(account.currency).toBe('BDT');
    expect(account.isActive).toBe(true);
    expect(account.bankDetail?.bankName).toBe('BRAC Bank');
    expect(account.mfsDetail).toBeNull();
    // No `balance` field anywhere on the wire shape.
    expect(account).not.toHaveProperty('balance');

    // A real, balanced JournalTransaction was posted: debit this account's own
    // ledger account, credit Opening Balance Equity — never a direct balance
    // assignment.
    const equityAccount = await prisma.ledgerAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, code: '3000' },
    });
    const journalTxn = await prisma.journalTransaction.findFirst({
      where: {
        farmId: owner.farmId,
        sourceType: 'FINANCIAL_ACCOUNT_OPENING_BALANCE',
        sourceId: account.id,
      },
      include: { entries: true },
    });
    expect(journalTxn).not.toBeNull();
    expect(journalTxn?.entries).toHaveLength(2);
    const debitLine = journalTxn?.entries.find(
      (e) => e.ledgerAccountId === account.ledgerAccountId,
    );
    const creditLine = journalTxn?.entries.find(
      (e) => e.ledgerAccountId === equityAccount.id,
    );
    expect(debitLine?.debit.toString()).toBe('50000');
    expect(creditLine?.credit.toString()).toBe('50000');
    // Balanced: sum(debit) === sum(credit).
    const totalDebit = journalTxn!.entries.reduce(
      (s, e) => s + Number(e.debit),
      0,
    );
    const totalCredit = journalTxn!.entries.reduce(
      (s, e) => s + Number(e.credit),
      0,
    );
    expect(totalDebit).toBe(totalCredit);

    // No `balance` column exists on the FinancialAccount row itself.
    const dbRow = await prisma.financialAccount.findUniqueOrThrow({
      where: { id: account.id },
    });
    expect(Object.keys(dbRow)).not.toContain('balance');
  });

  it('creates a CASH account with no opening balance and posts no journal', async () => {
    const name = uniqueName('Cash Box');

    const res = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({ name, type: FinancialAccountType.CASH })
      .expect(201);

    const account = (
      res.body as { data: { id: string; ledgerAccountId: string } }
    ).data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);

    const journalTxn = await prisma.journalTransaction.findFirst({
      where: {
        sourceType: 'FINANCIAL_ACCOUNT_OPENING_BALANCE',
        sourceId: account.id,
      },
    });
    expect(journalTxn).toBeNull();
  });

  it('creates an MFS account with its provider detail', async () => {
    const name = uniqueName('bKash Merchant');

    const res = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({
        name,
        type: FinancialAccountType.MFS,
        mfsDetail: {
          provider: MfsProvider.BKASH,
          phoneNumber: '01711111111',
          accountType: 'merchant',
        },
      })
      .expect(201);

    const account = (
      res.body as {
        data: {
          id: string;
          ledgerAccountId: string;
          mfsDetail: { provider: string; phoneNumber: string } | null;
        };
      }
    ).data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);

    expect(account.mfsDetail?.provider).toBe(MfsProvider.BKASH);
    expect(account.mfsDetail?.phoneNumber).toBe('01711111111');
  });

  it('rejects a BANK account with no bankDetail (400)', async () => {
    await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({
        name: uniqueName('No Detail Bank'),
        type: FinancialAccountType.BANK,
      })
      .expect(400);
  });

  it('GET /finance/accounts/:id returns the created account with its detail', async () => {
    const createRes = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({
        name: uniqueName('Nagad Personal'),
        type: FinancialAccountType.MFS,
        mfsDetail: { provider: MfsProvider.NAGAD, phoneNumber: '01822222222' },
      })
      .expect(201);
    const account = (
      createRes.body as { data: { id: string; ledgerAccountId: string } }
    ).data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);

    const getRes = await request(server())
      .get(api(`/finance/accounts/${account.id}`))
      .set(...bearer(owner))
      .expect(200);
    const fetched = (
      getRes.body as { data: { id: string; mfsDetail: { provider: string } } }
    ).data;
    expect(fetched.id).toBe(account.id);
    expect(fetched.mfsDetail.provider).toBe(MfsProvider.NAGAD);
  });

  it('PATCH /finance/accounts/:id updates the name and detail fields, never type/ledgerAccountId', async () => {
    const createRes = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({
        name: uniqueName('City Bank'),
        type: FinancialAccountType.BANK,
        bankDetail: { bankName: 'City Bank', accountNumber: '000111222' },
      })
      .expect(201);
    const account = (
      createRes.body as {
        data: { id: string; ledgerAccountId: string; type: string };
      }
    ).data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);

    const patchRes = await request(server())
      .patch(api(`/finance/accounts/${account.id}`))
      .set(...bearer(owner))
      .send({
        name: 'City Bank Renamed',
        bankDetail: { branch: 'Motijheel' },
      })
      .expect(200);
    const updated = (
      patchRes.body as {
        data: {
          name: string;
          type: string;
          ledgerAccountId: string;
          bankDetail: { branch: string | null };
        };
      }
    ).data;
    expect(updated.name).toBe('City Bank Renamed');
    expect(updated.bankDetail.branch).toBe('Motijheel');
    // Immutable fields unchanged.
    expect(updated.type).toBe(account.type);
    expect(updated.ledgerAccountId).toBe(account.ledgerAccountId);
  });

  it('archives an account (isActive:false + archivedAt) without deleting it, and rejects a double archive', async () => {
    const createRes = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({ name: uniqueName('To Archive'), type: FinancialAccountType.CASH })
      .expect(201);
    const account = (
      createRes.body as { data: { id: string; ledgerAccountId: string } }
    ).data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);

    const archiveRes = await request(server())
      .patch(api(`/finance/accounts/${account.id}/archive`))
      .set(...bearer(owner))
      .expect(200);
    const archived = (
      archiveRes.body as {
        data: { isActive: boolean; archivedAt: string | null };
      }
    ).data;
    expect(archived.isActive).toBe(false);
    expect(archived.archivedAt).not.toBeNull();

    // Not deleted — still fetchable by id.
    const stillThere = await prisma.financialAccount.findUnique({
      where: { id: account.id },
    });
    expect(stillThere).not.toBeNull();

    // Double archive rejected.
    await request(server())
      .patch(api(`/finance/accounts/${account.id}/archive`))
      .set(...bearer(owner))
      .expect(409);
  });

  it('RBAC: Worker cannot create or archive a financial account; Manager can', async () => {
    await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(worker))
      .send({
        name: uniqueName('Worker Attempt'),
        type: FinancialAccountType.CASH,
      })
      .expect(403);

    const managerRes = await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(manager))
      .send({
        name: uniqueName('Manager Cash'),
        type: FinancialAccountType.CASH,
      })
      .expect(201);
    const account = (
      managerRes.body as { data: { id: string; ledgerAccountId: string } }
    ).data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);

    await request(server())
      .get(api(`/finance/accounts/${account.id}`))
      .set(...bearer(worker))
      .expect(403);

    await request(server())
      .patch(api(`/finance/accounts/${account.id}/archive`))
      .set(...bearer(manager))
      .expect(200);
  });
});
