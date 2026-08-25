import { LedgerAccountCategory, Prisma } from '@prisma/client';
import type { PrismaService } from 'src/core/database/prisma/prisma.service';

// RAKHAL-354: `NON_VOID_TXN` deleted along with V1's `FinanceTransaction` —
// see `docs/CHANGELOG.md`'s RAKHAL-354 entry for the full history. Every
// remaining reader in this codebase reads Finance V2's `JournalEntry`
// instead, via `ledgerCategoryNet`/`ledgerAccountNet` below, which need no
// void/reversal filter of their own: a `JournalTransaction` reversal
// (RAKHAL-334) is an exact debit/credit mirror of the original, so summing
// `JournalEntry` rows across a transaction and its reversal nets to zero by
// construction.

type PrismaLike = PrismaService | Prisma.TransactionClient;

/** Half-open date bound, same shape Prisma's own `date: { gte, lt }` filters take. */
export interface LedgerDateRange {
  gte?: Date;
  lt?: Date;
}

const CREDIT_NORMAL_CATEGORIES: ReadonlySet<LedgerAccountCategory> = new Set([
  LedgerAccountCategory.REVENUE,
  LedgerAccountCategory.LIABILITY,
  LedgerAccountCategory.EQUITY,
]);

/**
 * Net movement (RAKHAL-351) for every `LedgerAccount` of one category on a
 * farm, over an optional `JournalTransaction.transactionDate` range —
 * `SUM(credit) - SUM(debit)` for credit-normal categories (REVENUE/
 * LIABILITY/EQUITY), `SUM(debit) - SUM(credit)` for debit-normal categories
 * (ASSET/EXPENSE). No void/reversal filter is needed: a reversal
 * (`JournalService.reverseJournal`) posts the exact debit/credit mirror of
 * the original transaction's lines, so the pair always nets to zero when
 * summed together — see this file's `NON_VOID_TXN` doc comment.
 */
export async function ledgerCategoryNet(
  prisma: PrismaLike,
  farmId: string,
  category: LedgerAccountCategory,
  range?: LedgerDateRange,
): Promise<number> {
  const agg = await prisma.journalEntry.aggregate({
    where: {
      ledgerAccount: { farmId, category },
      ...(range ? { journalTransaction: { transactionDate: range } } : {}),
    },
    _sum: { debit: true, credit: true },
  });
  const debit = Number(agg._sum.debit ?? 0);
  const credit = Number(agg._sum.credit ?? 0);
  return CREDIT_NORMAL_CATEGORIES.has(category)
    ? credit - debit
    : debit - credit;
}

/**
 * Same as {@link ledgerCategoryNet} but scoped to one specific `LedgerAccount`
 * by its `(farmId, code)` — e.g. `'5000'` (Feed) or `'5300'` (Breeding), see
 * `finance-v2/ledger/domain/default-chart-of-accounts.ts` for the full chart.
 * `category` must be the account's own category (caller's responsibility —
 * this only decides which side of the entry is "normal").
 */
export async function ledgerAccountNet(
  prisma: PrismaLike,
  farmId: string,
  code: string,
  category: LedgerAccountCategory,
  range?: LedgerDateRange,
): Promise<number> {
  const agg = await prisma.journalEntry.aggregate({
    where: {
      ledgerAccount: { farmId, code },
      ...(range ? { journalTransaction: { transactionDate: range } } : {}),
    },
    _sum: { debit: true, credit: true },
  });
  const debit = Number(agg._sum.debit ?? 0);
  const credit = Number(agg._sum.credit ?? 0);
  return CREDIT_NORMAL_CATEGORIES.has(category)
    ? credit - debit
    : debit - credit;
}

/**
 * `totalAmount - allocated`, clamped to `>= 0` and rounded to 2dp — the same
 * derivation `ReceivableService`/`PayableService` (finance-v2/purchasing) do
 * internally, duplicated here (as plain numbers, not `Prisma.Decimal`) for
 * the read-only aggregator services (Dashboard/Reports/Scheduler) that only
 * need one derived number per row and intentionally avoid importing those
 * services' farm-scoped methods for what would otherwise be a cross-farm
 * sweep (`SchedulerService`) or a bulk read (`DashboardService`,
 * `ReportGeneratorsService`) — matches this codebase's existing
 * no-cross-module-coupling convention for aggregator reads.
 */
export function deriveOutstanding(
  totalAmount: Prisma.Decimal.Value,
  allocated: Prisma.Decimal.Value,
): number {
  const raw = Number(totalAmount) - Number(allocated);
  return raw > 0 ? Math.round(raw * 100) / 100 : 0;
}
