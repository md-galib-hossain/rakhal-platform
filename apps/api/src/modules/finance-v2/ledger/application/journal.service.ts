import { Injectable } from '@nestjs/common';
import {
  JournalEntry,
  JournalTransaction,
  JournalTransactionStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { MoneyInput, toStorage } from 'src/common/money';
import {
  JournalAlreadyReversedError,
  JournalNotFoundError,
  assertBalanced,
  mirrorForReversal,
} from '../domain/journal-balance';

export type JournalTransactionWithEntries = JournalTransaction & {
  entries: JournalEntry[];
};

export interface PostJournalLine {
  ledgerAccountId: string;
  debit?: MoneyInput;
  credit?: MoneyInput;
}

export interface PostJournalInput {
  farmId: string;
  sourceType: string;
  sourceId: string;
  transactionDate: Date;
  description: string;
  /** Unique per farm — a replayed call with the same key is a no-op, see `postJournal`. */
  idempotencyKey: string;
  createdById: string;
  entries: PostJournalLine[];
}

export interface ReverseJournalInput {
  farmId: string;
  journalTransactionId: string;
  createdById: string;
  /** Unique per farm — a replayed reversal call with the same key is a no-op. */
  idempotencyKey: string;
  description?: string;
  transactionDate?: Date;
}

/**
 * Journal engine (RAKHAL-334, Finance V2 — `FINANCE_V2_DESIGN.md` §4.5, §6):
 * balanced, immutable, reversal-only. Sits alongside `LedgerAccountService`
 * (RAKHAL-333) in the same `finance-v2/ledger` module — every future
 * money-changing use case (Sale, Payment, Transfer, Purchase, ...) posts
 * through `postJournal`, never writes a `JournalTransaction`/`JournalEntry`
 * row directly.
 *
 * **No update/delete method is exposed for either model** — that is the
 * entire immutability guarantee. A `JournalTransaction`, once written, is
 * never touched again; `reverseJournal` only ever *creates* a new row.
 */
@Injectable()
export class JournalService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(JournalService.name);
  }

  /**
   * Posts a balanced journal transaction. `SUM(debit) === SUM(credit)` is
   * enforced by `assertBalanced` in the domain layer **before any DB
   * write** — an unbalanced posting throws and nothing is written.
   *
   * Accepts an optional `Prisma.TransactionClient` so a caller (a future
   * Sale/Payment/Transfer use case) can fold this posting into its own
   * `$transaction` alongside a stock movement, a receivable, etc — same
   * seam as `LedgerAccountService.seedDefaultChart`/RAKHAL-341's
   * `adjustStock`/RAKHAL-332's `OutboxWriterService.write`. When no `tx` is
   * supplied, the read-then-write (idempotency check + insert) is wrapped
   * internally in its own `this.prisma.$transaction(...)` so it is still
   * atomic on its own.
   *
   * Idempotent by `(farmId, idempotencyKey)`: a replayed call with the same
   * key returns the original transaction (with its entries) instead of
   * posting a duplicate — same convention as `OutboxWriterService.write`.
   */
  async postJournal(
    input: PostJournalInput,
    tx?: Prisma.TransactionClient,
  ): Promise<JournalTransactionWithEntries> {
    assertBalanced(input.entries);

    if (tx) {
      return this.postWithClient(tx, input);
    }
    return this.prisma.$transaction((t) => this.postWithClient(t, input));
  }

  private async postWithClient(
    client: Prisma.TransactionClient,
    input: PostJournalInput,
  ): Promise<JournalTransactionWithEntries> {
    const existing = await client.journalTransaction.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId: input.farmId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { entries: true },
    });
    if (existing) {
      this.log.info('Journal posting replayed — idempotent no-op', {
        farmId: input.farmId,
        idempotencyKey: input.idempotencyKey,
        journalTransactionId: existing.id,
      });
      return existing;
    }

    const created = await client.journalTransaction.create({
      data: {
        farmId: input.farmId,
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        transactionDate: input.transactionDate,
        description: input.description,
        status: JournalTransactionStatus.POSTED,
        idempotencyKey: input.idempotencyKey,
        createdById: input.createdById,
        entries: {
          create: input.entries.map((entry) => ({
            ledgerAccountId: entry.ledgerAccountId,
            debit: toStorage(entry.debit ?? 0),
            credit: toStorage(entry.credit ?? 0),
          })),
        },
      },
      include: { entries: true },
    });
    this.log.info('Journal transaction posted', {
      farmId: input.farmId,
      journalTransactionId: created.id,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      lines: created.entries.length,
    });
    return created;
  }

  /**
   * Reverses a previously posted transaction: creates a NEW
   * `JournalTransaction` (`status: REVERSED`, `reversalOfId` pointing at the
   * original) whose entry lines are the exact debit/credit mirror of the
   * original's lines, so the pair nets to zero per ledger account. The
   * original transaction is never updated or deleted.
   *
   * Throws `JournalNotFoundError` if the transaction id does not exist for
   * this farm, `JournalAlreadyReversedError` if it has already been
   * reversed once (checked by looking for an existing row whose
   * `reversalOfId` points at it — the original's own `status` column is
   * never flipped to record this, preserving strict immutability).
   *
   * Idempotent by `(farmId, idempotencyKey)` on the new reversal
   * transaction, same as `postJournal`.
   */
  async reverseJournal(
    input: ReverseJournalInput,
    tx?: Prisma.TransactionClient,
  ): Promise<JournalTransactionWithEntries> {
    if (tx) {
      return this.reverseWithClient(tx, input);
    }
    return this.prisma.$transaction((t) => this.reverseWithClient(t, input));
  }

  private async reverseWithClient(
    client: Prisma.TransactionClient,
    input: ReverseJournalInput,
  ): Promise<JournalTransactionWithEntries> {
    const existingReversal = await client.journalTransaction.findUnique({
      where: {
        farmId_idempotencyKey: {
          farmId: input.farmId,
          idempotencyKey: input.idempotencyKey,
        },
      },
      include: { entries: true },
    });
    if (existingReversal) {
      this.log.info('Journal reversal replayed — idempotent no-op', {
        farmId: input.farmId,
        idempotencyKey: input.idempotencyKey,
        journalTransactionId: existingReversal.id,
      });
      return existingReversal;
    }

    const original = await client.journalTransaction.findFirst({
      where: { id: input.journalTransactionId, farmId: input.farmId },
      include: { entries: true },
    });
    if (!original) {
      throw new JournalNotFoundError(input.journalTransactionId);
    }

    const alreadyReversed = await client.journalTransaction.findFirst({
      where: { reversalOfId: original.id, farmId: input.farmId },
      select: { id: true },
    });
    if (alreadyReversed) {
      throw new JournalAlreadyReversedError(original.id);
    }

    const mirroredEntries = mirrorForReversal(
      original.entries.map((entry) => ({
        ledgerAccountId: entry.ledgerAccountId,
        debit: entry.debit,
        credit: entry.credit,
      })),
    );
    // Reversal lines are already an exact mirror of an already-balanced
    // posting, so they are balanced by construction — assertBalanced is
    // still run as a defense-in-depth check before the write.
    assertBalanced(mirroredEntries);

    const reversal = await client.journalTransaction.create({
      data: {
        farmId: input.farmId,
        sourceType: original.sourceType,
        sourceId: original.sourceId,
        transactionDate: input.transactionDate ?? new Date(),
        description:
          input.description ?? `Reversal of: ${original.description}`,
        status: JournalTransactionStatus.REVERSED,
        reversalOfId: original.id,
        idempotencyKey: input.idempotencyKey,
        createdById: input.createdById,
        entries: {
          create: mirroredEntries.map((entry) => ({
            ledgerAccountId: entry.ledgerAccountId,
            debit: toStorage(entry.debit ?? 0),
            credit: toStorage(entry.credit ?? 0),
          })),
        },
      },
      include: { entries: true },
    });
    this.log.info('Journal transaction reversed', {
      farmId: input.farmId,
      originalJournalTransactionId: original.id,
      reversalJournalTransactionId: reversal.id,
    });
    return reversal;
  }

  /** One journal transaction with its entries, scoped by farm. Internal use only. */
  async findById(
    farmId: string,
    journalTransactionId: string,
  ): Promise<JournalTransactionWithEntries | null> {
    return this.prisma.journalTransaction.findFirst({
      where: { id: journalTransactionId, farmId },
      include: { entries: true },
    });
  }
}
