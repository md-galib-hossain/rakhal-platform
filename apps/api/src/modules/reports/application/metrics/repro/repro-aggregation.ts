import {
  classifyBreedingStatus,
  isReproductionEligible,
  type BreedingStatus,
} from '../../../domain/eligibility';
import { sum, type Money, type MoneyInput } from 'src/common/money';
import type { MetricValue } from '../../../domain/contracts/metric-value';

/**
 * Minimum DECIDED services (confirmed + failed) before a conception rate is shown. Below it the
 * rate is `not_calculated`: a rate over 2 services is noise, not a farm statement.
 */
export const MIN_DECIDED_FOR_CONCEPTION_RATE = 5;

/** A cow with at least this many FAILED services in the period cohort is raised as an exception. */
export const REPEATED_FAILED_SERVICES_THRESHOLD = 3;

export type ServiceMethod = 'AI' | 'NATURAL' | 'EMBRYO_TRANSFER';

export interface ServiceRow {
  cattleId: string;
  breedingMethod: ServiceMethod;
  status: BreedingStatus;
  voidedAt: Date | null;
  financeTransactionId: string | null;
  expectedPregnancyCheckDate: Date | null;
}

export interface ServiceAggregate {
  total: number;
  uniqueCows: number;
  byMethod: Record<ServiceMethod, { events: number; uniqueCows: number }>;
  confirmed: number;
  pending: number;
  failed: number;
  other: number;
  /** confirmed + failed: only these count in a conception rate. */
  decided: number;
  /** Pending checks whose expected date passed before `now`. */
  overdueChecks: number;
  /** Services that are resolved (non-pending) or overdue-pending: the checks that should exist. */
  dueForCheck: number;
  cowsWithRepeatedFailures: string[];
  aiWithoutCostLink: number;
}

const METHODS: ServiceMethod[] = ['AI', 'NATURAL', 'EMBRYO_TRANSFER'];

export function isOverdueCheck(row: ServiceRow, now: Date): boolean {
  return (
    classifyBreedingStatus(row.status) === 'pending' &&
    row.expectedPregnancyCheckDate !== null &&
    row.expectedPregnancyCheckDate.getTime() < now.getTime()
  );
}

/** Voided rows (timestamp or status) are excluded before anything is counted. */
export function aggregateServices(
  rows: readonly ServiceRow[],
  now: Date,
): ServiceAggregate {
  const eligible = rows.filter((r) => isReproductionEligible(r));
  const all = new Set<string>();
  const methodCows: Record<ServiceMethod, Set<string>> = {
    AI: new Set(),
    NATURAL: new Set(),
    EMBRYO_TRANSFER: new Set(),
  };
  const agg: ServiceAggregate = {
    total: eligible.length,
    uniqueCows: 0,
    byMethod: {
      AI: { events: 0, uniqueCows: 0 },
      NATURAL: { events: 0, uniqueCows: 0 },
      EMBRYO_TRANSFER: { events: 0, uniqueCows: 0 },
    },
    confirmed: 0,
    pending: 0,
    failed: 0,
    other: 0,
    decided: 0,
    overdueChecks: 0,
    dueForCheck: 0,
    cowsWithRepeatedFailures: [],
    aiWithoutCostLink: 0,
  };
  const failedPerCow = new Map<string, number>();
  for (const r of eligible) {
    all.add(r.cattleId);
    methodCows[r.breedingMethod].add(r.cattleId);
    agg.byMethod[r.breedingMethod].events++;
    if (r.breedingMethod === 'AI' && !r.financeTransactionId)
      agg.aiWithoutCostLink++;
    const cls = classifyBreedingStatus(r.status);
    const overdue = isOverdueCheck(r, now);
    if (cls === 'confirmed') agg.confirmed++;
    else if (cls === 'failed') {
      agg.failed++;
      failedPerCow.set(r.cattleId, (failedPerCow.get(r.cattleId) ?? 0) + 1);
    } else if (cls === 'pending') {
      agg.pending++;
      if (overdue) agg.overdueChecks++;
    } else agg.other++;
    if (cls !== 'pending' || overdue) agg.dueForCheck++;
  }
  agg.uniqueCows = all.size;
  for (const m of METHODS) agg.byMethod[m].uniqueCows = methodCows[m].size;
  agg.decided = agg.confirmed + agg.failed;
  agg.cowsWithRepeatedFailures = [...failedPerCow]
    .filter(([, n]) => n >= REPEATED_FAILED_SERVICES_THRESHOLD)
    .map(([id]) => id)
    .sort();
  return agg;
}

/**
 * confirmed / (confirmed + failed) x 100. Pending and other outcomes are never in the denominator.
 * `not_calculated` when nothing is decided or fewer than the minimum are.
 */
export function conceptionRate(
  confirmed: number,
  failed: number,
  minDecided: number = MIN_DECIDED_FOR_CONCEPTION_RATE,
): MetricValue {
  const decided = confirmed + failed;
  if (decided === 0)
    return {
      state: 'not_calculated',
      reason: 'no decided services (all pending or none recorded)',
    };
  if (decided < minDecided)
    return {
      state: 'not_calculated',
      reason: `small cohort: ${decided} decided services, minimum ${minDecided}`,
    };
  return { state: 'value', value: (confirmed / decided) * 100, unit: '%' };
}

/** Exact Decimal sum of already-filtered (non-voided) linked expense amounts. */
export function sumLinkedCost(amounts: readonly MoneyInput[]): Money {
  return sum(amounts);
}
