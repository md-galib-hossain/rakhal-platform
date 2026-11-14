/**
 * Pure milk aggregation for Reports v2 (RPT-04). No Prisma client, no I/O: plain rows in, plain
 * numbers out, so every rule is unit-testable with fixtures.
 *
 * Rules (EPIC_REPORTS decision 7 + brief):
 * - only `submitted` rows with a finite, non-negative yield count (a 0 yield IS a real zero);
 * - a cow-day with no row is MISSING, never 0; averages divide by cow-days WITH a row, never by
 *   calendar days (so `lactation-yield.averageDailyYield`, which counts missing as 0, is not used);
 * - `logDate` is the farm-local production day stored at UTC midnight, so its UTC `YYYY-MM-DD` IS
 *   the farm-local date: compare it to the period's `startDate`/`endDate`, never to instants.
 */
import type { MilkSession } from '@prisma/client';
import {
  buildDailyYieldSeries,
  type CurveEntry,
} from '../../../../reproduction/domain/lactation-curve';
import { detectSuddenDrop } from '../../../../reproduction/domain/lactation-alerts';
import { isMilkEligibleRow } from '../../../domain/eligibility/predicates';
import { addDaysYmd } from '../../../domain/period';

export interface MilkRow {
  cattleId: string;
  logDate: Date;
  session: MilkSession;
  yieldL: number;
  disposition: string;
  submitted: boolean;
}

export interface CowMilk {
  cattleId: string;
  totalYieldL: number;
  recordedDays: number;
  expectedDays: number;
  /** total / recordedDays (never / expectedDays). */
  avgPerRecordedDayL: number;
}

export interface DailyMilk {
  date: string;
  /** null = no row from any in-scope cow that day (missing, NOT zero). */
  yieldL: number | null;
  cowsRecorded: number;
}

export interface MilkAggregate {
  days: string[];
  cowCount: number;
  /** null when no eligible row exists at all. */
  totalYieldL: number | null;
  recordedCowDays: number;
  expectedCowDays: number;
  /** True when the cows x days fallback was used (no presence data). */
  expectedEstimated: boolean;
  /** Expected days per in-scope cow (also for cows without data). */
  expectedDaysByCow: Record<string, number>;
  /** total / recordedCowDays; null when recordedCowDays is 0. */
  avgDailyYieldPerRecordedCowDayL: number | null;
  cowsWithData: number;
  daily: DailyMilk[];
  /** Cows WITH data, sorted by cattleId. */
  perCow: CowMilk[];
  /** Cows in scope with no row in the period, sorted. */
  cowsWithoutData: string[];
  dispositionTotalsL: Record<string, number>;
}

export const dayKey = (d: Date): string => d.toISOString().slice(0, 10);

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * `days` is the list of farm-local dates that count as "expected" (the caller drops days that are
 * still in the future at generation time).
 */
export function aggregateMilk(input: {
  rows: readonly MilkRow[];
  cattleIds: readonly string[];
  days: readonly string[];
  /** Per-cow presence window (inclusive, farm-local). Absent => every cow expected every day. */
  presence?: ReadonlyMap<string, { startDate: string; endDate: string }>;
}): MilkAggregate {
  const cows = new Set(input.cattleIds);
  const dayList = [...input.days];
  let estimated = !input.presence;
  const expectedFor = (cattleId: string): number => {
    const w = input.presence?.get(cattleId);
    if (!w) {
      if (input.presence) estimated = true; // cow missing from a provided map
      return dayList.length;
    }
    return dayList.filter((d) => d >= w.startDate && d <= w.endDate).length;
  };
  const expectedByCow = new Map<string, number>(
    [...cows].map((id) => [id, expectedFor(id)]),
  );
  const daySet = new Set(dayList);

  const perCowMap = new Map<string, { total: number; days: Set<string> }>();
  const perDay = new Map<string, { total: number; cows: Set<string> }>();
  const dispositions: Record<string, number> = {};
  let total = 0;
  let any = false;

  for (const r of input.rows) {
    if (!cows.has(r.cattleId) || !isMilkEligibleRow(r)) continue;
    const k = dayKey(r.logDate);
    if (!daySet.has(k)) continue;
    any = true;
    total += r.yieldL;
    const c = perCowMap.get(r.cattleId) ?? { total: 0, days: new Set() };
    c.total += r.yieldL;
    c.days.add(k);
    perCowMap.set(r.cattleId, c);
    const d = perDay.get(k) ?? { total: 0, cows: new Set() };
    d.total += r.yieldL;
    d.cows.add(r.cattleId);
    perDay.set(k, d);
    dispositions[r.disposition] = (dispositions[r.disposition] ?? 0) + r.yieldL;
  }

  const perCow: CowMilk[] = [...perCowMap.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([cattleId, c]) => ({
      cattleId,
      totalYieldL: round2(c.total),
      recordedDays: c.days.size,
      expectedDays: expectedFor(cattleId),
      avgPerRecordedDayL: round2(c.total / c.days.size),
    }));
  const recordedCowDays = perCow.reduce((s, c) => s + c.recordedDays, 0);

  for (const k of Object.keys(dispositions)) {
    dispositions[k] = round2(dispositions[k]);
  }

  return {
    days: dayList,
    cowCount: cows.size,
    totalYieldL: any ? round2(total) : null,
    recordedCowDays,
    expectedCowDays: [...expectedByCow.values()].reduce((s, n) => s + n, 0),
    expectedEstimated: estimated,
    expectedDaysByCow: Object.fromEntries(expectedByCow),
    avgDailyYieldPerRecordedCowDayL:
      recordedCowDays > 0 ? round2(total / recordedCowDays) : null,
    cowsWithData: perCow.length,
    daily: dayList.map((date) => {
      const d = perDay.get(date);
      return {
        date,
        yieldL: d ? round2(d.total) : null,
        cowsRecorded: d?.cows.size ?? 0,
      };
    }),
    perCow,
    cowsWithoutData: [...cows].filter((id) => !perCowMap.has(id)).sort(),
    dispositionTotalsL: dispositions,
  };
}

/**
 * Top / bottom cows by average per recorded day. Never overlap: bottom takes from what is left
 * after top. Ties break by cattleId so output is deterministic.
 */
export function rankCows(
  perCow: readonly CowMilk[],
  n = 5,
): { top: CowMilk[]; bottom: CowMilk[] } {
  const sorted = [...perCow].sort(
    (a, b) =>
      b.avgPerRecordedDayL - a.avgPerRecordedDayL ||
      (a.cattleId < b.cattleId ? -1 : 1),
  );
  const top = sorted.slice(0, n);
  const rest = sorted.slice(top.length);
  const bottom = rest.slice(-n).reverse(); // lowest first
  return { top, bottom };
}

export interface SuddenDropFinding {
  cattleId: string;
  dropPct: number;
}

export interface SuddenDropEvaluation {
  /** Cows whose evaluated day AND 7 baseline days were all `complete`. */
  evaluatedCows: number;
  findings: SuddenDropFinding[];
}

/**
 * Per cow: last expected day of the period vs the mean of the 7 days before it, via the existing
 * `detectSuddenDrop`. A cow is evaluated ONLY when all 8 days are `complete` (every configured
 * session recorded); otherwise there is no finding at all (an incomplete day mimics a drop).
 * `rows` may reach back before the period start to cover the baseline.
 */
export function evaluateSuddenDrops(input: {
  rows: readonly MilkRow[];
  cattleIds: readonly string[];
  evaluatedDate: string | null;
  expectedSessions: MilkSession[];
  dropThresholdPct: number;
}): SuddenDropEvaluation {
  const out: SuddenDropEvaluation = { evaluatedCows: 0, findings: [] };
  if (!input.evaluatedDate) return out;
  const cows = new Set(input.cattleIds);
  const from = addDaysYmd(input.evaluatedDate, -7);
  const byCow = new Map<string, CurveEntry[]>();
  for (const r of input.rows) {
    if (!cows.has(r.cattleId) || !isMilkEligibleRow(r)) continue;
    const k = dayKey(r.logDate);
    if (k < from || k > input.evaluatedDate) continue;
    const list = byCow.get(r.cattleId) ?? [];
    list.push({ logDate: r.logDate, session: r.session, yieldL: r.yieldL });
    byCow.set(r.cattleId, list);
  }

  for (const cattleId of [...byCow.keys()].sort()) {
    const series = buildDailyYieldSeries({
      startDate: new Date(`${from}T00:00:00.000Z`),
      endDate: new Date(`${input.evaluatedDate}T00:00:00.000Z`),
      entries: byCow.get(cattleId) ?? [],
      expectedSessions: input.expectedSessions,
    });
    if (series.length !== 8 || series.some((p) => p.dataQuality !== 'complete'))
      continue;
    out.evaluatedCows++;
    const baseline = series.slice(0, 7);
    const res = detectSuddenDrop({
      evaluatedDayYieldL: series[7].yieldL,
      evaluatedDayDataQuality: series[7].dataQuality,
      baselineDaysDataQuality: baseline.map((p) => p.dataQuality),
      baselineAvgYieldL: baseline.reduce((s, p) => s + p.yieldL, 0) / 7,
      dropThresholdPct: input.dropThresholdPct,
    });
    if (res.fired && res.dropPct !== null)
      out.findings.push({ cattleId, dropPct: res.dropPct });
  }
  return out;
}
