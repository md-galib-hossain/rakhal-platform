/** Pure `YYYY-MM-DD` helpers (calendar math in UTC so DST/timezone never shifts a day). */

const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

/** True only for a real calendar date: `2026-02-31` and `2026-13-01` are rejected, `2028-02-29` is accepted. */
export function isValidYmd(value: string): boolean {
  const m = YMD.exec(value);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1) return false;
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}

function toUtcMs(ymd: string): number {
  const m = YMD.exec(ymd);
  if (!m) return Number.NaN;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** Inclusive day count between two valid dates (`2026-01-01`..`2026-01-01` = 1). NaN if either is invalid. */
export function inclusiveDays(from: string, to: string): number {
  if (!isValidYmd(from) || !isValidYmd(to)) return Number.NaN;
  return Math.round((toUtcMs(to) - toUtcMs(from)) / 86_400_000) + 1;
}
