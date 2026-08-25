import { LedgerAccountCategory } from '@prisma/client';
import type { PrismaService } from 'src/core/database/prisma/prisma.service';
import { ledgerCategoryNet } from './txn-filters';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface RunwayThresholds {
  warningDays: number;
  criticalDays: number;
}

export interface RunwaySnapshot {
  days: number | null;
  status: 'unknown' | 'critical' | 'warning' | 'healthy';
}

/**
 * RAKHAL-354: shared cash-runway derivation, extracted off the deleted V1
 * `FinanceService.getRunwaySnapshot()` (which read `WalletTransaction`/
 * `FinanceTransaction`, both dropped). Callers (`DashboardService`'s
 * `financeSnapshot()`, `SchedulerService`'s `sweepSurvivalRunwayWarning()`)
 * supply `liquidity` themselves — usually `BalanceService.getRakhalBalance
 * (farmId).rakhalBalance` — since fetching it is itself farm-scoped I/O this
 * helper shouldn't own (some callers already have it from a shared read;
 * avoids double-fetching). 30-day average expense comes from
 * `ledgerCategoryNet` over the EXPENSE ledger-account category, same
 * derivation V1's `avgDailyExpense()` used, just off the ledger instead of
 * `FinanceTransaction`.
 */
export async function computeRunwaySnapshot(
  prisma: PrismaService,
  farmId: string,
  liquidity: number,
  thresholds: RunwayThresholds,
  now: Date = new Date(),
): Promise<RunwaySnapshot> {
  const from = new Date(now.getTime() - 30 * DAY_MS);
  const expense30 = await ledgerCategoryNet(
    prisma,
    farmId,
    LedgerAccountCategory.EXPENSE,
    { gte: from, lt: now },
  );
  const avgDailyExpense = expense30 / 30;
  const days =
    avgDailyExpense > 0 ? Math.floor(liquidity / avgDailyExpense) : null;
  const status =
    days == null
      ? 'unknown'
      : days < thresholds.criticalDays
        ? 'critical'
        : days < thresholds.warningDays
          ? 'warning'
          : 'healthy';
  return { days, status };
}
