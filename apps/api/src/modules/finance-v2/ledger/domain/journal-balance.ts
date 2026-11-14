import { MoneyInput, eq, isNegative, sum, toMoney } from 'src/common/money';

/**
 * Pure domain layer for the journal engine (RAKHAL-334, `FINANCE_V2_DESIGN.md`
 * §4.5, §6). No Prisma/framework import beyond the shared `Money` primitive
 * (RAKHAL-331) — mirrors the existing precedent of `billing/domain/money.ts`
 * and other domain files importing `Prisma.Decimal` as a value type only.
 *
 * `JournalService.postJournal` calls `assertBalanced` **before any DB
 * write** — an unbalanced posting must never reach the database, per the
 * design doc's §6 invariant `Journal debit == journal credit, always`.
 */

/** One proposed debit-or-credit line, before it becomes a `JournalEntry` row. */
export interface JournalEntryLineInput {
  ledgerAccountId: string;
  /** Defaults to 0 when omitted — a line is either a debit line or a credit line. */
  debit?: MoneyInput;
  /** Defaults to 0 when omitted — a line is either a debit line or a credit line. */
  credit?: MoneyInput;
}

/** Thrown when `SUM(debit) !== SUM(credit)` across a proposed posting's lines. */
export class JournalUnbalancedError extends Error {
  constructor(
    public readonly totalDebit: string,
    public readonly totalCredit: string,
  ) {
    super(
      `Journal posting is unbalanced: total debit ${totalDebit} !== total credit ${totalCredit}`,
    );
    this.name = 'JournalUnbalancedError';
  }
}

/** Thrown when a posting has no lines at all — there is nothing to balance. */
export class JournalEmptyError extends Error {
  constructor() {
    super('Journal posting must have at least one entry line');
    this.name = 'JournalEmptyError';
  }
}

/**
 * Thrown when a single line carries a negative debit or credit amount, or
 * both a nonzero debit AND a nonzero credit on the same line. Each entry
 * line is either a debit line or a credit line — never both, never negative.
 */
export class JournalInvalidLineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'JournalInvalidLineError';
  }
}

/**
 * Validates one proposed posting's lines and throws before any DB write if
 * they are not valid double-entry lines, or throws `JournalUnbalancedError`
 * if `SUM(debit) !== SUM(credit)`. Returns nothing — callers proceed to
 * write once this does not throw.
 */
export function assertBalanced(
  entries: readonly JournalEntryLineInput[],
): void {
  if (entries.length === 0) {
    throw new JournalEmptyError();
  }

  for (const entry of entries) {
    const debit = toMoney(entry.debit ?? 0);
    const credit = toMoney(entry.credit ?? 0);
    if (isNegative(debit) || isNegative(credit)) {
      throw new JournalInvalidLineError(
        `Journal entry line for ledger account ${entry.ledgerAccountId} has a negative debit/credit`,
      );
    }
    if (!eq(debit, 0) && !eq(credit, 0)) {
      throw new JournalInvalidLineError(
        `Journal entry line for ledger account ${entry.ledgerAccountId} carries both a debit and a credit — a line must be one or the other`,
      );
    }
  }

  const totalDebit = sum(entries.map((entry) => entry.debit ?? 0));
  const totalCredit = sum(entries.map((entry) => entry.credit ?? 0));
  if (!eq(totalDebit, totalCredit)) {
    throw new JournalUnbalancedError(
      totalDebit.toFixed(2),
      totalCredit.toFixed(2),
    );
  }
}

/** Mirrors each line's debit/credit for a reversal — swap debit and credit. */
export function mirrorForReversal(
  entries: readonly JournalEntryLineInput[],
): JournalEntryLineInput[] {
  return entries.map((entry) => ({
    ledgerAccountId: entry.ledgerAccountId,
    debit: entry.credit ?? 0,
    credit: entry.debit ?? 0,
  }));
}

/** Thrown by `reverseJournal` when the target transaction has already been reversed once. */
export class JournalAlreadyReversedError extends Error {
  constructor(journalTransactionId: string) {
    super(
      `Journal transaction ${journalTransactionId} has already been reversed`,
    );
    this.name = 'JournalAlreadyReversedError';
  }
}

/** Thrown by `reverseJournal` when the target transaction id does not exist for the farm. */
export class JournalNotFoundError extends Error {
  constructor(journalTransactionId: string) {
    super(`Journal transaction ${journalTransactionId} not found`);
    this.name = 'JournalNotFoundError';
  }
}
