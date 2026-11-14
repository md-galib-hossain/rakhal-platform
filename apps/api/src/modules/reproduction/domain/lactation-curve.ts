/**
 * Pure daily-yield-by-DIM curve builder (RAKHAL-283). No framework/Prisma
 * imports so it's unit-testable without a Prisma double. `dim` (days in
 * milk) uses the same 0-based `floor(daysBetween(start, day))` convention
 * `CattleService`'s own inline lactation-curve computation already uses
 * (`cattle.service.ts`'s `daysBetween`), so a DIM value means the same thing
 * everywhere in this codebase.
 *
 * A day is flagged for data quality rather than silently zero-filled (the
 * ticket's explicit requirement): `missing` when no session was recorded at
 * all, `incomplete` when some but not all of the farm's configured active
 * sessions were recorded, `complete` otherwise.
 */
import { MilkSession } from '@prisma/client';

const DAY_MS = 24 * 60 * 60 * 1000;

export type DimDataQuality = 'complete' | 'incomplete' | 'missing';

export interface DailyYieldPoint {
  dim: number;
  date: string; // ISO date (yyyy-mm-dd, UTC)
  yieldL: number;
  sessionsRecorded: number;
  sessionsExpected: number;
  dataQuality: DimDataQuality;
}

export interface CurveEntry {
  logDate: Date;
  session: MilkSession;
  yieldL: number;
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}

function isoDate(date: Date): string {
  return startOfUtcDay(date).toISOString().slice(0, 10);
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Builds one point per calendar day from `startDate` to `endDate` (inclusive,
 * both UTC-day-truncated). `expectedSessions` is the farm's configured active
 * `MilkSession`s (`FarmSettingsService.milkActiveSessions`) — used only to
 * size the "how many sessions should exist today" denominator for the
 * data-quality marker, never to invent/zero-fill a missing session's yield.
 */
export function buildDailyYieldSeries(params: {
  startDate: Date;
  endDate: Date;
  entries: CurveEntry[];
  expectedSessions: MilkSession[];
}): DailyYieldPoint[] {
  const { startDate, endDate, entries, expectedSessions } = params;
  const start = startOfUtcDay(startDate);
  const end = startOfUtcDay(endDate);
  const expectedCount = Math.max(1, expectedSessions.length);

  const byDay = new Map<
    number,
    { yieldL: number; sessions: Set<MilkSession> }
  >();
  for (const e of entries) {
    const dayKey = startOfUtcDay(e.logDate).getTime();
    const bucket = byDay.get(dayKey) ?? {
      yieldL: 0,
      sessions: new Set<MilkSession>(),
    };
    bucket.yieldL += e.yieldL;
    bucket.sessions.add(e.session);
    byDay.set(dayKey, bucket);
  }

  const series: DailyYieldPoint[] = [];
  for (
    let cursor = start.getTime(), dim = 0;
    cursor <= end.getTime();
    cursor += DAY_MS, dim += 1
  ) {
    const day = new Date(cursor);
    const bucket = byDay.get(cursor);
    const sessionsRecorded = bucket?.sessions.size ?? 0;

    let dataQuality: DimDataQuality;
    if (sessionsRecorded === 0) {
      dataQuality = 'missing';
    } else if (sessionsRecorded < expectedCount) {
      dataQuality = 'incomplete';
    } else {
      dataQuality = 'complete';
    }

    series.push({
      dim,
      date: isoDate(day),
      yieldL: round(bucket?.yieldL ?? 0),
      sessionsRecorded,
      sessionsExpected: expectedCount,
      dataQuality,
    });
  }

  return series;
}
