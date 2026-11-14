import { LedgerAccountCategory } from '@prisma/client';
import { ledgerAccountNet } from 'src/common/finance/txn-filters';
import type { ReportPeriod } from '../../../domain/contracts/period';
import type { ReportDb } from '../metric-context';
import type { LowStockInput, RawFeedData } from './feed-aggregation';

export interface FeedFetchArgs {
  db: ReportDb;
  farmId: string;
  timezone: string;
  cattleIds: readonly string[];
  includeFinance: boolean;
}

/** Farm-local YYYY-MM-DD of an instant. */
export function localDayKey(d: Date, timezone: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/**
 * Thin reads for ONE period, all through `ctx.db` (the snapshot transaction client).
 * Without `includeFinance`: no cost column, no milk litres (only used for cost/litre) and no
 * ledger is read at all.
 */
export async function fetchPeriodRaw(
  a: FeedFetchArgs,
  period: ReportPeriod,
): Promise<RawFeedData> {
  const db = a.db;
  const start = new Date(period.start);
  const end = new Date(period.end);
  const inPeriod = { gte: start, lt: end };
  const cattleIds = [...a.cattleIds];
  const dateRange = {
    gte: new Date(period.startDate),
    lte: new Date(period.endDate),
  };

  const distributions = await db.feedDistribution.findMany({
    where: { farmId: a.farmId, voidedAt: null, distributedAt: inPeriod },
    select: {
      id: true,
      totalActualKg: true,
      totalRefusalKg: true,
      items: {
        select: {
          ingredientId: true,
          ingredientName: true,
          actualKg: true,
        },
      },
    },
  });
  const distributionIds = distributions.map((d) => d.id);

  const [cattleItems, fitDays, movements, milk, ledger] = await Promise.all([
    // `in: []` matches nothing, so an empty scope needs no special branch.
    db.feedDistributionCattleItem.findMany({
      where: {
        cattleId: { in: cattleIds },
        voidedAt: null,
        distribution: {
          farmId: a.farmId,
          voidedAt: null,
          distributedAt: inPeriod,
        },
      },
      select: {
        cattleId: true,
        offeredKg: true,
        refusalKg: true,
        ...(a.includeFinance ? { costTk: true } : {}),
        distribution: { select: { distributedAt: true } },
      },
    }),
    db.feedPlanFitDay.findMany({
      where: {
        farmId: a.farmId,
        cattleId: { in: cattleIds },
        date: dateRange,
      },
      select: {
        cattleId: true,
        date: true,
        severity: true,
        estimated: true,
      },
    }),
    // Only movements of non-voided distributions in the period. A per-cow void writes a
    // compensating ADJUSTMENT row carrying the same distributionId, so FED + ADJUSTMENT nets it.
    db.feedStockMovement.findMany({
      where: {
        reason: { in: ['FED', 'ADJUSTMENT'] },
        distributionId: { in: distributionIds },
        stock: { farmId: a.farmId },
      },
      select: { changeKg: true },
    }),
    a.includeFinance
      ? db.milkLogEntry.aggregate({
          where: {
            farmId: a.farmId,
            cattleId: { in: cattleIds },
            submitted: true,
            logDate: dateRange,
          },
          _count: { _all: true },
          _sum: { yieldL: true },
        })
      : Promise.resolve(null),
    a.includeFinance
      ? fetchLedger(db, a.farmId, inPeriod)
      : Promise.resolve(null),
  ]);

  return {
    distributions: distributions.map((d) => ({
      totalActualKg: d.totalActualKg,
      totalRefusalKg: d.totalRefusalKg,
      items: d.items,
    })),
    cattleItems: cattleItems.map((r) => ({
      cattleId: r.cattleId,
      dayKey: localDayKey(r.distribution.distributedAt, a.timezone),
      offeredKg: r.offeredKg,
      refusalKg: r.refusalKg,
      costTk: 'costTk' in r ? (r.costTk ?? null) : null,
    })),
    fitDays: fitDays.map((f) => ({
      cattleId: f.cattleId,
      date: f.date.toISOString().slice(0, 10),
      severity: f.severity,
      estimated: f.estimated,
    })),
    fedMovementKgs: movements.map((m) => m.changeKg),
    milk: milk
      ? { rows: milk._count._all, litres: milk._sum.yieldL ?? 0 }
      : { rows: 0, litres: 0 },
    ledgerNet: ledger ? ledger.net : null,
    ledgerAccountExists: ledger ? ledger.exists : true,
  };
}

/** Ledger 5000 net, or `exists:false` when the farm has no such account (never a fake 0). */
async function fetchLedger(
  db: ReportDb,
  farmId: string,
  inPeriod: { gte: Date; lt: Date },
): Promise<{ exists: boolean; net: number | null }> {
  const account = await db.ledgerAccount.findFirst({
    where: { farmId, code: '5000' },
    select: { id: true },
  });
  if (!account) return { exists: false, net: null };
  const net = await ledgerAccountNet(
    db,
    farmId,
    '5000',
    LedgerAccountCategory.EXPENSE,
    inPeriod,
  );
  return { exists: true, net };
}

/** Current state, not period-based: live feed items with a threshold and their live-lot stock. */
export async function fetchLowStockInputs(
  db: ReportDb,
  farmId: string,
): Promise<LowStockInput[]> {
  const items = await db.feedItem.findMany({
    where: { farmId, deletedAt: null, lowStockThreshold: { gt: 0 } },
    select: {
      id: true,
      name: true,
      lowStockThreshold: true,
      unit: { select: { symbol: true } },
      batches: {
        where: { deletedAt: null },
        select: { currentStock: true },
      },
    },
  });
  return items.map((i) => ({
    id: i.id,
    name: i.name,
    unit: i.unit.symbol,
    threshold: i.lowStockThreshold,
    batchStocks: i.batches.map((b) => b.currentStock),
  }));
}
