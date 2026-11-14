/** Half-open date range: `[from, to)`. */
export interface PeriodRange {
  from: Date;
  to: Date;
}

/**
 * Previous-period derivation (RAKHAL-371, MILESTONE 22, `BUSINESS_IA_PRD.md`
 * §6.2). One formula covers both cases the AC calls out separately: an
 * explicit custom range (`prev = [from − duration, from − 1ms]`) and a named
 * calendar preset (Aug 1–25 → **Jul 1–25**, a same-length slice of the prior
 * period, never the full prior calendar month) — both are the same generic
 * "shift the whole window back by its own duration" computation.
 *
 * Lives in `src/common/finance/`, not `business-reporting/domain/`, on
 * purpose: `DashboardService.financialSnapshot` must delegate to this same
 * logic (this ticket's own AC — "so there is exactly one implementation"),
 * but `dashboard/**` importing anything from `business-reporting/**` would
 * violate the leaf invariant RAKHAL-369's architecture test enforces
 * ("no module other than business-reporting itself may import it"). A
 * shared pure function in `common/` — the same precedent `txn-filters.ts`/
 * `runway.ts` already set — lets both `PeriodSummaryService` and
 * `DashboardService` call it with zero module-to-module coupling.
 *
 * This is also **the fix for the live defect** `dashboard.service.ts`'s old
 * `financialSnapshot` carried: it compared `monthStart..now` (a *partial*
 * current month) against `prevStart..monthStart` (a *full* previous
 * calendar month) — on the 25th of a month every KPI reported an artificial
 * ~19% collapse purely from comparing 25 days against 30+. This function
 * always compares equal-length windows.
 */
export function derivePreviousPeriod(period: PeriodRange): PeriodRange {
  const durationMs = period.to.getTime() - period.from.getTime();
  return {
    from: new Date(period.from.getTime() - durationMs),
    to: new Date(period.from.getTime() - 1),
  };
}

/**
 * Percent change from `previous` to `current`, rounded to 1 decimal place.
 * Returns `null` when `previous` is `0` — never `Infinity`, never a
 * fabricated `100` — so the UI can render "—"/"New" instead of a nonsense
 * number.
 */
export function changePct(current: number, previous: number): number | null {
  if (!previous) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
