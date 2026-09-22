import { ExpenseCategory, SaleStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';

/**
 * RAKHAL-352 — the ONE per-animal finance aggregation, replacing three
 * previously-disagreeing bucketers (`FINANCE_V2_DESIGN.md` §1.4). See
 * `docs/CHANGELOG.md`'s RAKHAL-352 entry for that original history.
 *
 * **RAKHAL-354 update**: V1 `FinanceTransaction` (the sole data source for
 * feed/health/breeding expense at the time RAKHAL-352 landed) is dropped.
 * Breeding is migrated onto a real V2 source — `Expense.cattleId` +
 * `category: BREEDING` (ledger account `5300`), the field RAKHAL-354 added
 * specifically for this join, populated by `ReproductionService`/
 * `ReproductionEditService`'s migrated breeding-cost posting (was V1
 * `FinanceService.recordTransaction`, now `ExpenseService.recordExpense`).
 * **Feed still has no V2 replacement and reads 0** — `Purchase`/`Expense`
 * still carry no general cattle-scoped join for arbitrary feed spend; RD-064
 * tracks that remaining gap.
 *
 * **RAKHAL-419 update**: health gains the same real V2 source breeding
 * already had — `Expense.cattleId` + `category: HEALTH` (ledger account
 * `5100`), populated by `HealthService.logTreatment`/`.recordTreatment`'s
 * treatment-cost posting. Both `GET /cattle/:id/finance` and
 * `GET /reproduction/lactations/:id/economics` still agree exactly (both
 * read the same real numbers now, not both reading 0), so RAKHAL-352's core
 * AC — "these two surfaces can never silently disagree again" — still holds.
 *
 * **RAKHAL-441 update**: feed gains its own real per-animal source, closing
 * the RD-064 gap this comment used to describe. Not an `Expense` row (feed
 * was never posted through V2 Expense) — `FeedDistributionCattleItem.costTk`,
 * frozen per cow at confirm time (`FeedFeedingGridService#confirm`). Summed
 * directly here (`sumFeedCost`), scoped by the parent distribution's
 * `distributedAt` (not `expenseDate` — feed has no `Expense` row to read a
 * date off), excluding voided rows and rows predating this column (`costTk
 * === null` reads as unknown, never backfilled to 0 — same convention as
 * `FeedDistributionItem.dmPct`).
 *
 * **Income** — real V2 FK join, no string matching: `AnimalSaleLine.cattleId`
 * -> `SaleLine.totalAmount` for the specific line (not `Sale.totalAmount`,
 * which could span several lines), excluding non-`CONFIRMED` sales. V2 has
 * no per-cow milk-sale tracking at all (`lactation-economics.service.ts`'s
 * own documented assumption: "milk sales are not tracked per cow in this
 * system"), so `income.milk_sales` is always 0 now that the V1 income read
 * is gone — same "no replacement, honest 0" treatment as the expense side.
 */

export type CattleExpenseBucket = 'feed' | 'health' | 'breeding' | 'others';

export interface CattleFinanceTotals {
  totalIncome: number;
  totalCost: number;
  expense: Record<CattleExpenseBucket, number>;
  income: { milk_sales: number; calf_sales: number };
}

/**
 * Sum of one `ExpenseCategory`'s unreversed `Expense` rows for a cattle in a
 * period. Shared by breeding (RAKHAL-354) and health (RAKHAL-419) — both are
 * a real FK join (`Expense.cattleId`), no `subType` regex.
 *
 * A reversed expense (`ExpenseService.reverseExpense` — the edit-triggered
 * void+repost both `ReproductionEditService` and, since RAKHAL-419,
 * `HealthService` use) leaves its `Expense` row in place (V2 never deletes
 * on reversal, only mirrors the ledger effect to zero) — this must exclude
 * it, or an edited cost double-counts both the old and new amount, same
 * class of bug `NON_VOID_TXN` existed to prevent for V1. Determined by
 * checking for a `JournalTransaction` whose `reversalOfId` points at this
 * expense's own posting (`sourceType: 'EXPENSE', sourceId: expense.id`).
 */
async function sumUnreversedExpense(
  prisma: PrismaService,
  farmId: string,
  cattleId: string,
  category: ExpenseCategory,
  start: Date,
  end: Date,
): Promise<number> {
  const rows = await prisma.expense.findMany({
    where: { farmId, cattleId, category, expenseDate: { gte: start, lt: end } },
    select: { id: true, amount: true },
  });
  if (rows.length === 0) return 0;

  // `reverseJournal` copies the original's `sourceType`/`sourceId` onto the
  // reversal row too (`journal.service.ts`'s own `reverseWithClient`), so
  // this query returns BOTH the original posting and its reversal (if any)
  // for the same expense id — `reversalOfId: null` picks only the original,
  // the row whose id the reversal actually points back at.
  const journalTxns = await prisma.journalTransaction.findMany({
    where: {
      farmId,
      sourceType: 'EXPENSE',
      sourceId: { in: rows.map((e) => e.id) },
      reversalOfId: null,
    },
    select: { id: true, sourceId: true },
  });
  const journalIdByExpenseId = new Map(
    journalTxns.map((j) => [j.sourceId, j.id]),
  );
  const reversals = await prisma.journalTransaction.findMany({
    where: { farmId, reversalOfId: { in: journalTxns.map((j) => j.id) } },
    select: { reversalOfId: true },
  });
  const reversedJournalIds = new Set(
    reversals.map((r) => r.reversalOfId as string),
  );
  const unreversed = rows.filter((e) => {
    const journalId = journalIdByExpenseId.get(e.id);
    return !journalId || !reversedJournalIds.has(journalId);
  });
  return unreversed.reduce((sum, e) => sum + Number(e.amount), 0);
}

/**
 * RAKHAL-441 — sum of one cow's frozen `costTk` across her active (non-voided)
 * `FeedDistributionCattleItem` rows in a period, scoped by the parent
 * distribution's `distributedAt` (feed has no `Expense` row to date-scope
 * off). A voided row is excluded by its own `voidedAt` flag, not re-derived —
 * `voidCattleItem` already shrinks the sibling aggregate at void time, this
 * is just "don't count it a second time" on the read side.
 */
async function sumFeedCost(
  prisma: PrismaService,
  farmId: string,
  cattleId: string,
  start: Date,
  end: Date,
): Promise<number> {
  const rows = await prisma.feedDistributionCattleItem.findMany({
    where: {
      cattleId,
      voidedAt: null,
      costTk: { not: null },
      distribution: { farmId, distributedAt: { gte: start, lt: end } },
    },
    select: { costTk: true },
  });
  return rows.reduce((sum, r) => sum + (r.costTk ?? 0), 0);
}

export async function computeCattleFinance(
  prisma: PrismaService,
  farmId: string,
  cattleId: string,
  start: Date,
  end: Date,
): Promise<CattleFinanceTotals> {
  const [animalSaleLines, breedingCost, healthCost, feedCost] =
    await Promise.all([
      // Real FK join for animal-sale revenue (RAKHAL-339/345) — no string match.
      prisma.animalSaleLine.findMany({
        where: {
          cattleId,
          saleLine: {
            sale: {
              farmId,
              status: SaleStatus.CONFIRMED,
              saleDate: { gte: start, lt: end },
            },
          },
        },
        select: { saleLine: { select: { totalAmount: true } } },
      }),
      sumUnreversedExpense(
        prisma,
        farmId,
        cattleId,
        ExpenseCategory.BREEDING,
        start,
        end,
      ),
      sumUnreversedExpense(
        prisma,
        farmId,
        cattleId,
        ExpenseCategory.HEALTH,
        start,
        end,
      ),
      sumFeedCost(prisma, farmId, cattleId, start, end),
    ]);

  let totalIncome = 0;
  const income = { milk_sales: 0, calf_sales: 0 };
  for (const line of animalSaleLines) {
    const amount = Number(line.saleLine.totalAmount);
    totalIncome += amount;
    income.calf_sales += amount;
  }

  const expense: Record<CattleExpenseBucket, number> = {
    feed: feedCost,
    health: healthCost,
    breeding: breedingCost,
    others: 0,
  };
  const totalCost = feedCost + breedingCost + healthCost;

  return { totalIncome, totalCost, expense, income };
}

/**
 * `ExpenseCategory` -> `CattleExpenseBucket` classifier. Kept as its own
 * exported function (rather than inlined) since `computeCattleFinance` only
 * ever produces `BREEDING`/`HEALTH` rows today — this stays the single seam
 * a future ticket extends when feed gains a real per-animal V2 source.
 */
export function cattleExpenseBucket(
  category: ExpenseCategory,
): CattleExpenseBucket {
  if (category === ExpenseCategory.BREEDING) return 'breeding';
  if (category === ExpenseCategory.HEALTH) return 'health';
  return 'others';
}
