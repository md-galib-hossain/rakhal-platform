/**
 * Resolved reporting period. Built by RPT-02 from farm-time helpers; this file is the shape only.
 *
 * Conventions:
 * - Weeks run Monday to Sunday (EPIC_REPORTS section 2: week start is fixed, no setting).
 * - `start` is INCLUSIVE and `end` is EXCLUSIVE (UTC instants of farm-local midnights), so a
 *   period is `[start, end)` and adjacent periods never overlap or leave a gap, even across DST.
 * - `startDate` / `endDate` are farm-local `YYYY-MM-DD`, BOTH INCLUSIVE (what a human reads).
 *   `end` is the local midnight after `endDate`.
 */
export interface ReportPeriod {
  start: string; // ISO-8601 UTC instant, inclusive
  end: string; // ISO-8601 UTC instant, exclusive
  startDate: string; // farm-local YYYY-MM-DD, inclusive
  endDate: string; // farm-local YYYY-MM-DD, inclusive
  timezone: string; // IANA, e.g. Asia/Dhaka (Farm.timezone)
  label: string; // display label, e.g. "2026-W42" or "October 2026"
}
