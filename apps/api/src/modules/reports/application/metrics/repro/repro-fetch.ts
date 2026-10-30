import { toMoney, type Money } from 'src/common/money';
import type { ReportDb } from '../metric-context';
import type { ReportPeriod } from '../../../domain/contracts/period';
import type { ServiceRow } from './repro-aggregation';

const range = (p: ReportPeriod) => ({
  gte: new Date(p.start),
  lt: new Date(p.end),
});

const SERVICE_SELECT = {
  cattleId: true,
  breedingMethod: true,
  status: true,
  financeTransactionId: true,
  expectedPregnancyCheckDate: true,
} as const;

/**
 * RAKHAL-482: HISTORICAL entries (intake / back-dated history) feed state but not
 * the rate metrics. Spread into a breeding / calving / abortion `where`.
 */
export type NotHistorical =
  | { OR: [{ animalEventId: null }, { animalEventId: { notIn: string[] } }] }
  | Record<string, never>;

/** One look-up per report: the clause that leaves HISTORICAL events out (empty when there are none). */
export async function notHistoricalClause(
  db: ReportDb,
  farmId: string,
): Promise<NotHistorical> {
  const rows = await db.animalEvent.findMany({
    where: {
      farmId,
      provenance: 'HISTORICAL',
      status: 'ACTIVE',
      type: { in: ['BREEDING', 'CALVING', 'ABORTION'] },
    },
    select: { id: true },
  });
  if (rows.length === 0) return {};
  return {
    OR: [
      { animalEventId: null },
      { animalEventId: { notIn: rows.map((r) => r.id) } },
    ],
  };
}

/** Events have no farmId: scope is `cattleId in cattleIds` AND `cattle.farmId` (defence in depth). */
export async function fetchCohortServices(
  db: ReportDb,
  farmId: string,
  cattleIds: readonly string[],
  period: ReportPeriod,
  notHistorical: NotHistorical = {},
): Promise<ServiceRow[]> {
  if (cattleIds.length === 0) return [];
  const rows = await db.breedingEvent.findMany({
    where: {
      cattleId: { in: [...cattleIds] },
      cattle: { farmId },
      voidedAt: null,
      breedingDate: range(period),
      ...notHistorical,
    },
    select: SERVICE_SELECT,
  });
  return rows.map((r) => ({ ...r, voidedAt: null })); // filtered in the query
}

/** Current state: every unresolved service of an in-scope cow, whatever its breeding date. */
export async function fetchPendingServices(
  db: ReportDb,
  farmId: string,
  cattleIds: readonly string[],
  notHistorical: NotHistorical = {},
): Promise<ServiceRow[]> {
  if (cattleIds.length === 0) return [];
  const rows = await db.breedingEvent.findMany({
    where: {
      cattleId: { in: [...cattleIds] },
      cattle: { farmId },
      voidedAt: null,
      status: 'PENDING_CHECK',
      ...notHistorical,
    },
    select: SERVICE_SELECT,
  });
  return rows.map((r) => ({ ...r, voidedAt: null })); // filtered in the query
}

export interface CalvingCounts {
  calvings: number;
  calves: number;
}

export async function fetchCalvings(
  db: ReportDb,
  farmId: string,
  cattleIds: readonly string[],
  period: ReportPeriod,
  notHistorical: NotHistorical = {},
): Promise<CalvingCounts> {
  if (cattleIds.length === 0) return { calvings: 0, calves: 0 };
  const rows = await db.calvingEvent.findMany({
    where: {
      cattleId: { in: [...cattleIds] },
      cattle: { farmId },
      calvingDate: range(period),
      ...notHistorical,
    },
    select: { calfCount: true },
  });
  return {
    calvings: rows.length,
    calves: rows.reduce((s, r) => s + r.calfCount, 0),
  };
}

export async function fetchAbortions(
  db: ReportDb,
  farmId: string,
  cattleIds: readonly string[],
  period: ReportPeriod,
  notHistorical: NotHistorical = {},
): Promise<number> {
  if (cattleIds.length === 0) return 0;
  return db.abortionEvent.count({
    where: {
      cattleId: { in: [...cattleIds] },
      cattle: { farmId },
      abortionDate: range(period),
      ...notHistorical,
    },
  });
}

/** Active pregnancies due to calve in [from, to). */
export async function fetchExpectedCalvings(
  db: ReportDb,
  farmId: string,
  cattleIds: readonly string[],
  from: Date,
  to: Date,
): Promise<number> {
  if (cattleIds.length === 0) return 0;
  return db.pregnancy.count({
    where: {
      cattleId: { in: [...cattleIds] },
      cattle: { farmId },
      status: 'ACTIVE',
      expectedCalvingDate: { gte: from, lt: to },
    },
  });
}

/** Non-voided Expense amounts linked from breeding events (read, never re-resolved). */
export async function fetchLinkedExpenses(
  db: ReportDb,
  farmId: string,
  expenseIds: readonly string[],
): Promise<Money[]> {
  if (expenseIds.length === 0) return [];
  const rows = await db.expense.findMany({
    where: { id: { in: [...expenseIds] }, farmId, voidedAt: null },
    select: { amount: true },
  });
  return rows.map((r) => toMoney(r.amount));
}
