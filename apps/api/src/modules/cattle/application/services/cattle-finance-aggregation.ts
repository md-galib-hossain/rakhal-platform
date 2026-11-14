import {
  ExpenseCategory,
  MilkDisposition,
  SaleLineType,
  SaleStatus,
} from '@prisma/client';
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
 * **Income**:
 * - Calf / animal sale: real V2 FK join (`AnimalSaleLine.cattleId` ->
 *   `SaleLine.totalAmount` for the specific line), excluding non-`CONFIRMED` sales.
 * - Milk revenue: milk is physically pooled in bulk storage (`MilkTank`) and sold
 *   at farm level (`SaleLineType.MILK` / `MilkDispatch`), so individual cow milk
 *   revenue is computed managerially as `saleableYieldLitres * effectiveMilkRatePerLitre`
 *   (same proven economic model used in `LactationEconomicsService`), resolving rate from
 *   the latest confirmed milk sale, latest dispatch, or active buyer base price.
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

/**
 * Resolves the effective milk price per litre for a farm on or before a given date.
 * 1. Checks the most recent confirmed SaleLine of type MILK on or before the date.
 * 2. If none, checks the most recent non-cancelled MilkDispatch on or before the date.
 * 3. If none, falls back to the average basePricePerLitre of active MilkBuyers.
 * 4. Falls back to 0 when no sale/dispatch/buyer exists.
 */
export async function resolveEffectiveMilkRate(
  prisma: PrismaService,
  farmId: string,
  onOrBefore: Date,
): Promise<number> {
  const latestMilkSaleLine = prisma.saleLine
    ? await prisma.saleLine.findFirst({
        where: {
          type: SaleLineType.MILK,
          sale: {
            farmId,
            status: SaleStatus.CONFIRMED,
            saleDate: { lte: onOrBefore },
          },
        },
        orderBy: { sale: { saleDate: 'desc' } },
        select: { unitPrice: true },
      })
    : null;
  if (latestMilkSaleLine && Number(latestMilkSaleLine.unitPrice) > 0) {
    return Number(latestMilkSaleLine.unitPrice);
  }

  const latestDispatch = prisma.milkDispatch
    ? await prisma.milkDispatch.findFirst({
        where: { farmId, cancelledAt: null, dispatchedAt: { lte: onOrBefore } },
        orderBy: { dispatchedAt: 'desc' },
        select: { basePricePerLitre: true },
      })
    : null;
  if (latestDispatch && latestDispatch.basePricePerLitre > 0) {
    return latestDispatch.basePricePerLitre;
  }

  if (!prisma.milkBuyer) return 0;
  const activeBuyers = await prisma.milkBuyer.findMany({
    where: { farmId, deletedAt: null },
    select: { basePricePerLitre: true },
  });
  if (activeBuyers.length === 0) return 0;

  const validBuyers = activeBuyers.filter(
    (b) => b.basePricePerLitre !== null && b.basePricePerLitre > 0,
  );
  if (validBuyers.length === 0) return 0;

  const sum = validBuyers.reduce(
    (acc, b) => acc + (b.basePricePerLitre ?? 0),
    0,
  );
  return sum / validBuyers.length;
}

/**
 * Sum of one cow's saleable milk volume (litres) across her active MilkLogEntry rows in a period [start, end).
 */
export async function sumSaleableMilkLitres(
  prisma: PrismaService,
  cattleId: string,
  start: Date,
  end: Date,
): Promise<number> {
  if (!prisma.milkLogEntry) return 0;
  const rows = await prisma.milkLogEntry.findMany({
    where: {
      cattleId,
      disposition: MilkDisposition.SALEABLE,
      logDate: { gte: start, lt: end },
    },
    select: { yieldL: true },
  });
  return rows.reduce((sum, r) => sum + r.yieldL, 0);
}

export async function computeCattleFinance(
  prisma: PrismaService,
  farmId: string,
  cattleId: string,
  start: Date,
  end: Date,
): Promise<CattleFinanceTotals> {
  const [
    animalSaleLines,
    breedingCost,
    healthCost,
    feedCost,
    saleableLitres,
  ] = await Promise.all([
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
    sumSaleableMilkLitres(prisma, cattleId, start, end),
  ]);

  const effectiveRate =
    saleableLitres > 0
      ? await resolveEffectiveMilkRate(prisma, farmId, end)
      : 0;

  const milkRevenue =
    Math.round(saleableLitres * effectiveRate * 100) / 100;

  let totalIncome = milkRevenue;
  const income = { milk_sales: milkRevenue, calf_sales: 0 };
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
