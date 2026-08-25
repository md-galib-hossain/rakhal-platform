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
 * **Feed/health have no V2 replacement and now read 0** — `Purchase`/
 * `Expense` still carry no general cattle-scoped join for arbitrary feed/
 * medicine spend (only the one-off `Expense.cattleId` this ticket added for
 * breeding); filed as new tech debt (`docs/TECH_DEBT.md`) rather than kept
 * alive by reading a dropped table. Both `GET /cattle/:id/finance` and
 * `GET /reproduction/lactations/:id/economics` still agree exactly (both
 * read 0 for `health`), so RAKHAL-352's core AC — "these two surfaces can
 * never silently disagree again" — still holds.
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

export async function computeCattleFinance(
  prisma: PrismaService,
  farmId: string,
  cattleId: string,
  start: Date,
  end: Date,
): Promise<CattleFinanceTotals> {
  const [animalSaleLines, breedingExpenses] = await Promise.all([
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
    // Real FK join for breeding-cost expense (RAKHAL-330, migrated onto V2
    // by RAKHAL-354) — no `subType` regex.
    prisma.expense.findMany({
      where: {
        farmId,
        cattleId,
        category: ExpenseCategory.BREEDING,
        expenseDate: { gte: start, lt: end },
      },
      select: { id: true, amount: true },
    }),
  ]);

  // RAKHAL-354: a reversed breeding expense (`ExpenseService.reverseExpense`
  // — `ReproductionEditService`'s edit-triggered void+repost) leaves its
  // `Expense` row in place (V2 never deletes on reversal, only mirrors the
  // ledger effect to zero) — this must exclude it, or an edited breeding
  // cost double-counts both the old and new amount, same class of bug
  // `NON_VOID_TXN` existed to prevent for V1. Determined by checking for a
  // `JournalTransaction` whose `reversalOfId` points at this expense's own
  // posting (`sourceType: 'EXPENSE', sourceId: expense.id`).
  let unreversedBreedingExpenses = breedingExpenses;
  if (breedingExpenses.length > 0) {
    // `reverseJournal` copies the original's `sourceType`/`sourceId` onto the
    // reversal row too (`journal.service.ts`'s own `reverseWithClient`), so
    // this query returns BOTH the original posting and its reversal (if any)
    // for the same expense id — `reversalOfId: null` picks only the
    // original, the row whose id the reversal actually points back at.
    const journalTxns = await prisma.journalTransaction.findMany({
      where: {
        farmId,
        sourceType: 'EXPENSE',
        sourceId: { in: breedingExpenses.map((e) => e.id) },
        reversalOfId: null,
      },
      select: { id: true, sourceId: true },
    });
    const journalIdByExpenseId = new Map(
      journalTxns.map((j) => [j.sourceId, j.id]),
    );
    const reversals = await prisma.journalTransaction.findMany({
      where: {
        farmId,
        reversalOfId: { in: journalTxns.map((j) => j.id) },
      },
      select: { reversalOfId: true },
    });
    const reversedJournalIds = new Set(
      reversals.map((r) => r.reversalOfId as string),
    );
    unreversedBreedingExpenses = breedingExpenses.filter((e) => {
      const journalId = journalIdByExpenseId.get(e.id);
      return !journalId || !reversedJournalIds.has(journalId);
    });
  }

  let totalIncome = 0;
  let totalCost = 0;
  const expense: Record<CattleExpenseBucket, number> = {
    feed: 0,
    health: 0,
    breeding: 0,
    others: 0,
  };
  const income = { milk_sales: 0, calf_sales: 0 };

  for (const line of animalSaleLines) {
    const amount = Number(line.saleLine.totalAmount);
    totalIncome += amount;
    income.calf_sales += amount;
  }

  for (const e of unreversedBreedingExpenses) {
    const amount = Number(e.amount);
    totalCost += amount;
    expense.breeding += amount;
  }

  return { totalIncome, totalCost, expense, income };
}

/**
 * `ExpenseCategory` -> `CattleExpenseBucket` classifier. Kept as its own
 * exported function (rather than inlined) since `computeCattleFinance` only
 * ever produces `BREEDING` rows today — this stays the single seam a future
 * ticket extends when feed/health gain a real per-animal V2 source.
 */
export function cattleExpenseBucket(
  category: ExpenseCategory,
): CattleExpenseBucket {
  if (category === ExpenseCategory.BREEDING) return 'breeding';
  return 'others';
}
