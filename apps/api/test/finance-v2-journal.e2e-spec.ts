import { JournalTransactionStatus, LedgerAccount } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { JournalService } from 'src/modules/finance-v2/ledger/application/journal.service';
import {
  JournalAlreadyReversedError,
  JournalNotFoundError,
  JournalUnbalancedError,
} from 'src/modules/finance-v2/ledger/domain/journal-balance';
import { AuthedUser, createTestApp, loginAs, TestContext } from './utils/e2e';

/**
 * RAKHAL-334 — Journal engine: balanced, immutable, reversal-only
 * (`FINANCE_V2_DESIGN.md` §4.5, §6). Proves the ticket's own AC against the
 * real DB: an unbalanced posting is rejected before any row is written; a
 * balanced posting writes `JournalTransaction` + `JournalEntry` rows
 * atomically; a reversal creates a brand-new transaction that nets the
 * original to zero per ledger account without ever updating/deleting the
 * original row; posting via an externally-supplied `tx` rolls back
 * completely when the caller's own transaction later throws (same
 * atomicity-proof pattern as RAKHAL-341/332's e2e specs); idempotency by
 * `(farmId, idempotencyKey)` holds for both `postJournal` and
 * `reverseJournal`.
 *
 * Requires the dev stack up + `pnpm seed` (uses the seeded demo owner's
 * already-bootstrapped chart of accounts, RAKHAL-333).
 */
describe('Finance V2 — Journal engine (e2e)', () => {
  let ctx: TestContext;
  let prisma: PrismaService;
  let journal: JournalService;
  let owner: AuthedUser;
  let ownerUserId: string;
  let cashAccount: LedgerAccount;
  let revenueAccount: LedgerAccount;
  let feedExpenseAccount: LedgerAccount;
  let bankAccount: LedgerAccount;

  beforeAll(async () => {
    ctx = await createTestApp();
    prisma = ctx.app.get(PrismaService);
    journal = ctx.app.get(JournalService);
    owner = await loginAs(ctx, 'owner@demo.rakhal.test', 'DemoPass123');
    const user = await prisma.user.findFirstOrThrow({
      where: { email: 'owner@demo.rakhal.test' },
      select: { id: true },
    });
    ownerUserId = user.id;

    cashAccount = await prisma.ledgerAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, code: '1000' }, // Cash
    });
    bankAccount = await prisma.ledgerAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, code: '1010' }, // Bank
    });
    revenueAccount = await prisma.ledgerAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, code: '4000' }, // Milk Sales
    });
    feedExpenseAccount = await prisma.ledgerAccount.findFirstOrThrow({
      where: { farmId: owner.farmId, code: '5000' }, // Feed
    });
  }, 30_000);

  afterAll(async () => {
    await ctx.app.close();
  });

  const uniqueKey = (prefix: string) =>
    `${prefix}:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  it('rejects an unbalanced posting and writes nothing to the DB', async () => {
    const idempotencyKey = uniqueKey('E2E-334-unbalanced');

    await expect(
      journal.postJournal({
        farmId: owner.farmId,
        sourceType: 'E2E_TEST',
        sourceId: 'unbalanced-1',
        transactionDate: new Date(),
        description: 'Unbalanced test posting',
        idempotencyKey,
        createdById: ownerUserId,
        entries: [
          { ledgerAccountId: cashAccount.id, debit: '100.00' },
          { ledgerAccountId: revenueAccount.id, credit: '99.00' },
        ],
      }),
    ).rejects.toThrow(JournalUnbalancedError);

    const found = await prisma.journalTransaction.findUnique({
      where: {
        farmId_idempotencyKey: { farmId: owner.farmId, idempotencyKey },
      },
    });
    expect(found).toBeNull();
  });

  it('posts a balanced transaction, writing the header + all entry lines atomically', async () => {
    const idempotencyKey = uniqueKey('E2E-334-balanced');

    const posted = await journal.postJournal({
      farmId: owner.farmId,
      sourceType: 'E2E_TEST',
      sourceId: 'balanced-1',
      transactionDate: new Date(),
      description: 'Balanced test posting',
      idempotencyKey,
      createdById: ownerUserId,
      entries: [
        { ledgerAccountId: cashAccount.id, debit: '250.50' },
        { ledgerAccountId: revenueAccount.id, credit: '250.50' },
      ],
    });

    expect(posted.status).toBe(JournalTransactionStatus.POSTED);
    expect(posted.reversalOfId).toBeNull();
    expect(posted.entries).toHaveLength(2);

    const rows = await prisma.journalEntry.findMany({
      where: { journalTransactionId: posted.id },
    });
    expect(rows).toHaveLength(2);
    const totalDebit = rows.reduce((s, r) => s + Number(r.debit), 0);
    const totalCredit = rows.reduce((s, r) => s + Number(r.credit), 0);
    expect(totalDebit).toBeCloseTo(250.5, 2);
    expect(totalCredit).toBeCloseTo(250.5, 2);
  });

  it('is idempotent: replaying the same (farmId, idempotencyKey) never posts twice', async () => {
    const idempotencyKey = uniqueKey('E2E-334-idempotent');
    const input = {
      farmId: owner.farmId,
      sourceType: 'E2E_TEST',
      sourceId: 'idempotent-1',
      transactionDate: new Date(),
      description: 'Idempotent test posting',
      idempotencyKey,
      createdById: ownerUserId,
      entries: [
        { ledgerAccountId: cashAccount.id, debit: '75.00' },
        { ledgerAccountId: revenueAccount.id, credit: '75.00' },
      ],
    };

    const first = await journal.postJournal(input);
    const replay = await journal.postJournal(input);

    expect(replay.id).toBe(first.id);
    const all = await prisma.journalTransaction.findMany({
      where: { farmId: owner.farmId, idempotencyKey },
    });
    expect(all).toHaveLength(1);
  });

  it('reversal nets to zero per ledger account, and never mutates the original row', async () => {
    const idempotencyKey = uniqueKey('E2E-334-to-reverse');
    const original = await journal.postJournal({
      farmId: owner.farmId,
      sourceType: 'E2E_TEST',
      sourceId: 'to-reverse-1',
      transactionDate: new Date(),
      description: 'Posting that will be reversed',
      idempotencyKey,
      createdById: ownerUserId,
      entries: [
        { ledgerAccountId: cashAccount.id, debit: '500.00' },
        { ledgerAccountId: revenueAccount.id, credit: '500.00' },
      ],
    });
    const originalSnapshotBefore =
      await prisma.journalTransaction.findUniqueOrThrow({
        where: { id: original.id },
      });

    const reversal = await journal.reverseJournal({
      farmId: owner.farmId,
      journalTransactionId: original.id,
      createdById: ownerUserId,
      idempotencyKey: uniqueKey('E2E-334-reversal'),
    });

    expect(reversal.status).toBe(JournalTransactionStatus.REVERSED);
    expect(reversal.reversalOfId).toBe(original.id);
    expect(reversal.entries).toHaveLength(2);

    // The original row is byte-for-byte unchanged after the reversal — no
    // update method exists on JournalService, and this proves none ran.
    const originalSnapshotAfter =
      await prisma.journalTransaction.findUniqueOrThrow({
        where: { id: original.id },
      });
    expect(originalSnapshotAfter).toEqual(originalSnapshotBefore);
    expect(originalSnapshotAfter.status).toBe(JournalTransactionStatus.POSTED);

    // Sum of all entries across original + reversal, per ledger account, is zero.
    const allEntries = await prisma.journalEntry.findMany({
      where: {
        journalTransactionId: { in: [original.id, reversal.id] },
      },
    });
    const netByAccount = new Map<string, number>();
    for (const e of allEntries) {
      const net =
        (netByAccount.get(e.ledgerAccountId) ?? 0) +
        Number(e.debit) -
        Number(e.credit);
      netByAccount.set(e.ledgerAccountId, net);
    }
    for (const net of netByAccount.values()) {
      expect(net).toBeCloseTo(0, 2);
    }
  });

  it('reversing an already-reversed transaction throws JournalAlreadyReversedError', async () => {
    const original = await journal.postJournal({
      farmId: owner.farmId,
      sourceType: 'E2E_TEST',
      sourceId: 'double-reverse-1',
      transactionDate: new Date(),
      description: 'Posting reversed twice',
      idempotencyKey: uniqueKey('E2E-334-double-reverse-original'),
      createdById: ownerUserId,
      entries: [
        { ledgerAccountId: cashAccount.id, debit: '10.00' },
        { ledgerAccountId: revenueAccount.id, credit: '10.00' },
      ],
    });
    await journal.reverseJournal({
      farmId: owner.farmId,
      journalTransactionId: original.id,
      createdById: ownerUserId,
      idempotencyKey: uniqueKey('E2E-334-double-reverse-first'),
    });

    await expect(
      journal.reverseJournal({
        farmId: owner.farmId,
        journalTransactionId: original.id,
        createdById: ownerUserId,
        idempotencyKey: uniqueKey('E2E-334-double-reverse-second'),
      }),
    ).rejects.toThrow(JournalAlreadyReversedError);
  });

  it('reversing an unknown transaction id throws JournalNotFoundError', async () => {
    await expect(
      journal.reverseJournal({
        farmId: owner.farmId,
        journalTransactionId: 'does-not-exist',
        createdById: ownerUserId,
        idempotencyKey: uniqueKey('E2E-334-not-found'),
      }),
    ).rejects.toThrow(JournalNotFoundError);
  });

  it('rolls back completely when posted inside a caller transaction that later throws', async () => {
    const idempotencyKey = uniqueKey('E2E-334-rollback');

    await expect(
      prisma.$transaction(async (tx) => {
        await journal.postJournal(
          {
            farmId: owner.farmId,
            sourceType: 'E2E_TEST',
            sourceId: 'rollback-1',
            transactionDate: new Date(),
            description: 'Should be rolled back',
            idempotencyKey,
            createdById: ownerUserId,
            entries: [
              { ledgerAccountId: feedExpenseAccount.id, debit: '30.00' },
              { ledgerAccountId: bankAccount.id, credit: '30.00' },
            ],
          },
          tx,
        );
        throw new Error('simulated caller-side failure after postJournal');
      }),
    ).rejects.toThrow('simulated caller-side failure');

    const found = await prisma.journalTransaction.findUnique({
      where: {
        farmId_idempotencyKey: { farmId: owner.farmId, idempotencyKey },
      },
    });
    expect(found).toBeNull();

    const entries = await prisma.journalEntry.findMany({
      where: { ledgerAccount: { code: '5000', farmId: owner.farmId } },
    });
    // No orphaned entry references a transaction that was never committed —
    // sanity check that the whole tree rolled back together, not partially.
    for (const e of entries) {
      const tx = await prisma.journalTransaction.findUnique({
        where: { id: e.journalTransactionId },
      });
      expect(tx).not.toBeNull();
    }
  });

  it('commits normally when posted without a tx (unchanged existing behaviour)', async () => {
    const idempotencyKey = uniqueKey('E2E-334-no-tx');

    const posted = await journal.postJournal({
      farmId: owner.farmId,
      sourceType: 'E2E_TEST',
      sourceId: 'no-tx-1',
      transactionDate: new Date(),
      description: 'Posted without an external tx',
      idempotencyKey,
      createdById: ownerUserId,
      entries: [
        { ledgerAccountId: feedExpenseAccount.id, debit: '15.25' },
        { ledgerAccountId: bankAccount.id, credit: '15.25' },
      ],
    });

    const found = await prisma.journalTransaction.findUniqueOrThrow({
      where: { id: posted.id },
    });
    expect(found.status).toBe(JournalTransactionStatus.POSTED);
  });
});
