/**
 * Pure lactation-yield aggregation helpers (RAKHAL-283). No framework/Prisma
 * imports so they're unit-testable without a Prisma double, mirroring the
 * `lactation-stage.ts`/`pregnancy-stage.ts` precedent in this same directory.
 * `LactationStatsService` fetches `MilkLogEntry` rows for a cow's lactation
 * date range and hands the raw rows to these functions to compute
 * today/7-day/30-day yields and lactation-to-date totals by `MilkDisposition`.
 */
import { MilkDisposition } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

export interface YieldEntry {
  logDate: Date;
  yieldL: number;
  disposition: MilkDisposition;
}

/** Start-of-UTC-day for a given date (matches `MilkLogEntry.logDate`'s "production day, UTC midnight" convention). */
export function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function daysBetween(start: Date, end: Date): number {
  return Math.floor(
    (startOfUtcDay(end).getTime() - startOfUtcDay(start).getTime()) / DAY_MS,
  );
}

/** Sum of `yieldL` for entries whose `logDate` falls on the same UTC day as `day`. */
export function sumYieldForDay(entries: YieldEntry[], day: Date): number {
  const target = startOfUtcDay(day).getTime();
  return round(
    entries
      .filter((e) => startOfUtcDay(e.logDate).getTime() === target)
      .reduce((sum, e) => sum + e.yieldL, 0),
  );
}

/**
 * Rolling average daily yield over the trailing `windowDays` calendar days
 * ending on `referenceDate` (inclusive). The window is clamped so it never
 * starts before `lactationStart` — a cow that's only been milking for 3 days
 * has no meaningful "30-day average" beyond those 3 days, so the divisor is
 * the number of elapsed lactation days, not the full window, when the
 * lactation is younger than the window. Missing days count as zero yield
 * (a real production gap), not as excluded — this pulls the average down on
 * purpose rather than silently ignoring a missed/incomplete session.
 */
export function averageDailyYield(
  entries: YieldEntry[],
  params: { referenceDate: Date; windowDays: number; lactationStart: Date },
): number {
  const { referenceDate, windowDays, lactationStart } = params;
  const elapsedDays = Math.max(
    1,
    daysBetween(lactationStart, referenceDate) + 1,
  );
  const effectiveDays = Math.min(windowDays, elapsedDays);
  const windowStart = new Date(referenceDate);
  windowStart.setUTCDate(windowStart.getUTCDate() - (effectiveDays - 1));
  const windowStartDay = startOfUtcDay(windowStart).getTime();
  const windowEndDay = startOfUtcDay(referenceDate).getTime();

  const total = entries
    .filter((e) => {
      const day = startOfUtcDay(e.logDate).getTime();
      return day >= windowStartDay && day <= windowEndDay;
    })
    .reduce((sum, e) => sum + e.yieldL, 0);

  return round(total / effectiveDays);
}

export interface LactationTotalsByDisposition {
  produced: number;
  saleable: number;
  withheld: number;
  colostrum: number;
  calfFeed: number;
  discarded: number;
  householdUse: number;
}

/** Lactation-to-date totals, split by `MilkDisposition` (RAKHAL-283 AC). */
export function totalsByDisposition(
  entries: YieldEntry[],
): LactationTotalsByDisposition {
  const totals: LactationTotalsByDisposition = {
    produced: 0,
    saleable: 0,
    withheld: 0,
    colostrum: 0,
    calfFeed: 0,
    discarded: 0,
    householdUse: 0,
  };

  for (const e of entries) {
    totals.produced += e.yieldL;
    switch (e.disposition) {
      case MilkDisposition.SALEABLE:
        totals.saleable += e.yieldL;
        break;
      case MilkDisposition.WITHHELD:
        totals.withheld += e.yieldL;
        break;
      case MilkDisposition.COLOSTRUM:
        totals.colostrum += e.yieldL;
        break;
      case MilkDisposition.CALF_FEED:
        totals.calfFeed += e.yieldL;
        break;
      case MilkDisposition.DISCARDED:
        totals.discarded += e.yieldL;
        break;
      case MilkDisposition.HOUSEHOLD_USE:
        totals.householdUse += e.yieldL;
        break;
    }
  }

  (Object.keys(totals) as (keyof LactationTotalsByDisposition)[]).forEach(
    (key) => {
      totals[key] = round(totals[key]);
    },
  );

  return totals;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
