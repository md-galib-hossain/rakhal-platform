/**
 * Calendar-date (`YYYY-MM-DD`) arithmetic on pure civil dates. No timezone involved: a civil date has no
 * DST. Instants are produced elsewhere via `farmDayStart`.
 */
import { InvalidDateError } from './errors';

const YMD_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function toUtcMs(ymd: string): number {
  const m = YMD_RE.exec(ymd);
  if (!m) throw new InvalidDateError(ymd);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ms = Date.UTC(y, mo - 1, d);
  const back = new Date(ms);
  // Reject 2026-02-30 style overflow.
  if (
    back.getUTCFullYear() !== y ||
    back.getUTCMonth() !== mo - 1 ||
    back.getUTCDate() !== d
  ) {
    throw new InvalidDateError(ymd);
  }
  return ms;
}

const fromUtcMs = (ms: number): string =>
  new Date(ms).toISOString().slice(0, 10);

export function assertYmd(ymd: string): string {
  toUtcMs(ymd);
  return ymd;
}

export function addDaysYmd(ymd: string, days: number): string {
  return fromUtcMs(toUtcMs(ymd) + days * 86_400_000);
}

/** Whole civil days from `a` to `b` (b - a). */
export function diffDaysYmd(a: string, b: string): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

/** 1 = Monday ... 7 = Sunday. */
export function isoWeekday(ymd: string): number {
  const d = new Date(toUtcMs(ymd)).getUTCDay();
  return d === 0 ? 7 : d;
}

export function mondayOf(ymd: string): string {
  return addDaysYmd(ymd, -(isoWeekday(ymd) - 1));
}

export function parseYmd(ymd: string): { y: number; m: number; d: number } {
  toUtcMs(ymd);
  const [y, m, d] = ymd.split('-').map(Number);
  return { y, m, d };
}

export function makeYmd(y: number, m: number, d: number): string {
  return fromUtcMs(Date.UTC(y, m - 1, d));
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

/** ISO-8601 week-year and week number of the week containing `ymd`. */
export function isoWeekOf(ymd: string): { year: number; week: number } {
  const thursday = addDaysYmd(mondayOf(ymd), 3);
  const { y } = parseYmd(thursday);
  const week = Math.floor(diffDaysYmd(`${y}-01-01`, thursday) / 7) + 1;
  return { year: y, week };
}

/** Inclusive list of dates `from..to`. Empty when `from > to`. */
export function enumerateYmd(from: string, to: string): string[] {
  const n = diffDaysYmd(from, to);
  const out: string[] = [];
  for (let i = 0; i <= n; i++) out.push(addDaysYmd(from, i));
  return out;
}
