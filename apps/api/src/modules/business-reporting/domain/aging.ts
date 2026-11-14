/**
 * RAKHAL-369 (MILESTONE 22, `BUSINESS_IA_PRD.md` §6.3, §9.3) — aging buckets
 * measured as **days past due**: `daysPastDue = max(0, asOf - dueDate)`. A
 * `dueDate: null` document is always `CURRENT` — treated as if its due date
 * were `asOf` itself, so it never accrues overdue days.
 *
 * One domain constant, consumed by both `AgingService.getReceivablesAging`
 * and `getPayablesAging` so the bucket edges can never drift between the two
 * sides of the books.
 */
export interface AgingBucketDef {
  key: 'CURRENT' | 'OVERDUE_8_30' | 'OVERDUE_31_PLUS';
  label: string;
  minDays: number;
  maxDays: number | null;
}

export const RECEIVABLE_AGING_BUCKETS: readonly AgingBucketDef[] = [
  { key: 'CURRENT', label: 'Current (0–7 days)', minDays: 0, maxDays: 7 },
  {
    key: 'OVERDUE_8_30',
    label: 'Overdue 8–30 days',
    minDays: 8,
    maxDays: 30,
  },
  {
    key: 'OVERDUE_31_PLUS',
    label: 'Overdue 31+ days',
    minDays: 31,
    maxDays: null,
  },
] as const;

/**
 * Builds a SQL `CASE` expression bucketing an integer `daysExpr` column per
 * `RECEIVABLE_AGING_BUCKETS`. Safe to interpolate raw into a query — every
 * value here is a compile-time constant, never user input.
 */
export function buildAgingBucketCaseSql(daysExpr: string): string {
  const whens = RECEIVABLE_AGING_BUCKETS.map((b) =>
    b.maxDays === null
      ? `ELSE '${b.key}'`
      : `WHEN ${daysExpr} <= ${b.maxDays} THEN '${b.key}'`,
  );
  return `CASE ${whens.join(' ')} END`;
}
