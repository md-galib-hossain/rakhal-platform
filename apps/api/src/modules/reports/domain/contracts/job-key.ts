import type { ReportType } from './enums';

/**
 * Identity of a SCHEDULED report. Equals the planned unique key
 * `(farmId, type, periodStart, templateVersion)` on `Report` (EPIC_REPORTS section 4): inserting the
 * same key twice is a conflict, which the sweep treats as "already claimed, skip". Two instances or
 * a re-run of the hourly sweep therefore produce exactly one report per farm/period/template version.
 * A new template version yields a new key (a deliberate regeneration); on-demand reports have no key.
 */
export interface ScheduledReportKeyInput {
  farmId: string;
  type: Extract<ReportType, 'WEEKLY' | 'MONTHLY'>;
  /** Farm-local first day of the period, `YYYY-MM-DD`. */
  periodStartDate: string;
  templateVersion: number;
}

/** Farm ids are Prisma `cuid()` (see prisma/schemas/farm/farm.prisma): 'c' + 24 lowercase alphanumerics. */
export const FARM_ID_PATTERN = /^c[a-z0-9]{24}$/;

export function scheduledReportKey(input: ScheduledReportKeyInput): string {
  const { farmId, type, periodStartDate, templateVersion } = input;
  if (!FARM_ID_PATTERN.test(farmId ?? '')) {
    throw new Error('farmId must be a cuid (no whitespace or ":")');
  }
  if (type !== 'WEEKLY' && type !== 'MONTHLY')
    throw new Error(`Not a scheduled type: ${String(type)}`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(periodStartDate)) {
    throw new Error('periodStartDate must be YYYY-MM-DD');
  }
  if (!Number.isInteger(templateVersion) || templateVersion < 1) {
    throw new Error('templateVersion must be a positive integer');
  }
  return `${farmId}:${type}:${periodStartDate}:v${templateVersion}`;
}
