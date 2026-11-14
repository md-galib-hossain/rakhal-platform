import request from 'supertest';
import { FinancialAccountType, MfsProvider } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  AuthedUser,
  bearer,
  createTestApp,
  loginAs,
  createThrowawayOwner,
  deleteThrowawayOwner,
  TestContext,
} from './utils/e2e';
import { createExtraAccount } from './utils/finance';

/**
 * RAKHAL-335 — `FinancialAccount` (Cash/Bank/MFS) + detail tables + opening
 * balances (`FINANCE_V2_DESIGN.md` §3, §4.4). Proves the ticket's own AC
 * against the real DB + HTTP surface: creating a BANK account with an opening
 * balance produces the account row, its `BankAccountDetail`, AND a real
 * balanced `JournalTransaction` (debit the account's own ledger account,
 * credit Opening Balance Equity) — never a stored balance column; archiving
 * sets `deletedAt` without deleting the row; RBAC holds
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

    const res = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name,
          type: FinancialAccountType.BANK,
          bankDetail: {
            bankName: 'BRAC Bank',
            accountNumber: '1234567890123',
            branch: 'Gulshan',
          },
          openingBalance: 50000,
        }),
      },
    };

    const account = (
      res.body as {
        data: {
          id: string;
          name: string;
          type: string;
          ledgerAccountId: string;
          currency: string;
          deletedAt: string | null;
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
    expect(account.deletedAt).toBeNull();
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

    const res = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name,
          type: FinancialAccountType.CASH,
        }),
      },
    };

    const account = res.body.data;
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

    const res = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name,
          type: FinancialAccountType.MFS,
          mfsDetail: {
            provider: MfsProvider.BKASH,
            phoneNumber: '01711111111',
            accountType: 'merchant',
          },
        }),
      },
    };

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
    const createRes = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name: uniqueName('Nagad Personal'),
          type: FinancialAccountType.MFS,
          mfsDetail: {
            provider: MfsProvider.NAGAD,
            phoneNumber: '01822222222',
          },
        }),
      },
    };
    const account = createRes.body.data;
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
    const createRes = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name: uniqueName('City Bank'),
          type: FinancialAccountType.BANK,
          bankDetail: { bankName: 'City Bank', accountNumber: '000111222' },
        }),
      },
    };
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

  it('archives an account (deletedAt set) without deleting it, and rejects a double archive', async () => {
    const createRes = {
      body: {
        data: await createExtraAccount(ctx, prisma, owner, {
          name: uniqueName('To Archive'),
          type: FinancialAccountType.CASH,
        }),
      },
    };
    const account = createRes.body.data;
    createdAccountIds.push(account.id);
    createdLedgerAccountIds.push(account.ledgerAccountId);

    const archiveRes = await request(server())
      .patch(api(`/finance/accounts/${account.id}/archive`))
      .set(...bearer(owner))
      .expect(200);
    const archived = (
      archiveRes.body as {
        data: { deletedAt: string | null };
      }
    ).data;
    expect(archived.deletedAt).not.toBeNull();

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

    const managerRes = {
      body: {
        data: await createExtraAccount(ctx, prisma, manager, {
          name: uniqueName('Manager Cash'),
          type: FinancialAccountType.CASH,
        }),
      },
    };
    const account = managerRes.body.data;
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

  it('one account per farm: a second live account is rejected with 409', async () => {
    await request(server())
      .post(api('/finance/accounts'))
      .set(...bearer(owner))
      .send({ name: uniqueName('Second'), type: FinancialAccountType.CASH })
      .expect(409);
  });

  it('a brand-new farm gets its first account as primary, then 409s a second', async () => {
    const t = await createThrowawayOwner(
      ctx,
      prisma,
      uniqueName('OneAcct Farm'),
    );
    try {
      const first = await request(server())
        .post(api('/finance/accounts'))
        .set(...bearer(t.owner))
        .send({
          name: 'Main',
          type: FinancialAccountType.CASH,
          openingBalance: 100,
        })
        .expect(201);
      expect(
        (first.body as { data: { isPrimary: boolean } }).data.isPrimary,
      ).toBe(true);
      await request(server())
        .post(api('/finance/accounts'))
        .set(...bearer(t.owner))
        .send({ name: 'Other', type: FinancialAccountType.CASH })
        .expect(409);
      // Archiving the only account frees the slot (rename/replace flow).
      const id = (first.body as { data: { id: string } }).data.id;
      await request(server())
        .patch(api(`/finance/accounts/${id}/archive`))
        .set(...bearer(t.owner))
        .expect(200);
      await request(server())
        .post(api('/finance/accounts'))
        .set(...bearer(t.owner))
        .send({ name: 'Replacement', type: FinancialAccountType.CASH })
        .expect(201);
    } finally {
      await prisma.journalEntry
        .deleteMany({ where: { journalTransaction: { farmId: t.farmId } } })
        .catch(() => undefined);
      await prisma.journalTransaction
        .deleteMany({ where: { farmId: t.farmId } })
        .catch(() => undefined);
      await prisma.financialAccount
        .deleteMany({ where: { farmId: t.farmId } })
        .catch(() => undefined);
      await deleteThrowawayOwner(prisma, t);
    }
  });

  it('PATCH /finance/accounts/:id/opening-balance corrects the opening balance (reverse + repost)', async () => {
    const t = await createThrowawayOwner(
      ctx,
      prisma,
      uniqueName('OpenBal Farm'),
    );
    const balanceOf = async (id: string): Promise<string | undefined> => {
      const res = await request(server())
        .get(api('/finance/balance'))
        .set(...bearer(t.owner))
        .expect(200);
      return (
        res.body as {
          data: { accounts: Array<{ id: string; balance: string }> };
        }
      ).data.accounts.find((a) => a.id === id)?.balance;
    };
    const setOb = (id: string, openingBalance: number, user = t.owner) =>
      request(server())
        .patch(api(`/finance/accounts/${id}/opening-balance`))
        .set(...bearer(user))
        .send({ openingBalance });
    try {
      const created = await request(server())
        .post(api('/finance/accounts'))
        .set(...bearer(t.owner))
        .send({
          name: 'Main',
          type: FinancialAccountType.CASH,
          openingBalance: 1000,
        })
        .expect(201);
      const id = (created.body as { data: { id: string } }).data.id;
      expect(await balanceOf(id)).toBe('1000');

      await setOb(id, 400).expect(200);
      expect(await balanceOf(id)).toBe('400');
      await setOb(id, 0).expect(200);
      expect(await balanceOf(id)).toBe('0');
      await setOb(id, 250).expect(200);
      expect(await balanceOf(id)).toBe('250');

      await setOb(id, -5).expect(400);
      await setOb(id, 10, worker).expect(403);
    } finally {
      await prisma.journalEntry
        .deleteMany({ where: { journalTransaction: { farmId: t.farmId } } })
        .catch(() => undefined);
      await prisma.journalTransaction
        .updateMany({
          where: { farmId: t.farmId },
          data: { reversalOfId: null },
        })
        .catch(() => undefined);
      await prisma.journalTransaction
        .deleteMany({ where: { farmId: t.farmId } })
        .catch(() => undefined);
      await prisma.financialAccount
        .deleteMany({ where: { farmId: t.farmId } })
        .catch(() => undefined);
      await deleteThrowawayOwner(prisma, t);
    }
  });
});
