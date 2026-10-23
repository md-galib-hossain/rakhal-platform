import type { ReportDomain } from './enums';
import type { ReportPeriod } from './period';
import type { ReportScope } from './scope';
import type { MetricResult, MetricValue } from './metric-value';
import type { DataQuality } from './data-quality';

export interface SnapshotSection {
  id: string;
  domain: ReportDomain;
  titleKey: string;
  metrics: MetricResult[];
}

export interface ReportException {
  code: string;
  domain: ReportDomain;
  /** i18n key. */
  messageKey: string;
  cattleIds?: string[];
}

/**
 * The single immutable object the detail view AND the PDF render from. Written once inside the
 * generating transaction; never updated. A report built without `finance.read` has
 * `includesFinance: false` and finance content is structurally ABSENT (not hidden).
 */
export interface ReportSnapshotPayload {
  schemaVersion: number;
  calcVersion: number;
  templateVersion: number;
  farm: { id: string; name: string; timezone: string };
  period: ReportPeriod;
  previousPeriod?: ReportPeriod;
  scope: ReportScope;
  /** ISO instant. */
  generatedAt: string;
  includesFinance: boolean;
  sections: SnapshotSection[];
  exceptions: ReportException[];
  dataQuality: DataQuality;
}

/** Metric/row `source` values that identify finance-derived figures (exact match). */
export const FINANCE_SOURCE_DENYLIST: readonly string[] = [
  'cash_ledger',
  'expense_accrual',
  'ledgerFeed5000',
  'distributionCost',
  'vet_fee',
];

const isFinanceUnit = (u: string): boolean =>
  u === 'BDT' || u.startsWith('BDT/');

const isFinanceSource = (src: string | null | undefined): boolean =>
  !!src && (FINANCE_SOURCE_DENYLIST.includes(src) || src.startsWith('ledger'));

const isFinanceException = (e: ReportException): boolean =>
  e.domain === 'finance' || /cost|cash|ledger/i.test(e.code);

function checkValue(v: MetricValue | undefined, where: string): void {
  if (v && v.state === 'value' && isFinanceUnit(v.unit)) {
    throw new Error(
      `Finance unit "${v.unit}" in ${where} of finance-free report`,
    );
  }
}

/** Throws if a payload marked finance-free carries any finance section, exception or metric. */
export function assertNoFinance(payload: ReportSnapshotPayload): void {
  if (payload.includesFinance) return;
  for (const s of payload.sections) {
    if (s.domain === 'finance')
      throw new Error(`Finance section "${s.id}" in finance-free report`);
    for (const m of s.metrics) {
      if (m.requiresPermission === 'finance.read') {
        throw new Error(
          `Finance metric "${m.metricId}" in finance-free report`,
        );
      }
      if (String(m.metricId).startsWith('finance.')) {
        throw new Error(
          `Finance metric id "${m.metricId}" in finance-free report`,
        );
      }
      if (isFinanceSource(m.source)) {
        throw new Error(
          `Finance source "${m.source}" on "${m.metricId}" in finance-free report`,
        );
      }
      const where = `metric "${m.metricId}"`;
      checkValue(m.value, where);
      checkValue(m.comparison?.current, where);
      checkValue(m.comparison?.previous, where);
      for (const p of m.series ?? []) checkValue(p.value, `${where} series`);
      for (const r of m.rows ?? []) {
        if (isFinanceSource(r.source)) {
          throw new Error(
            `Finance source "${r.source}" on row "${r.key}" of "${m.metricId}" in finance-free report`,
          );
        }
        checkValue(r.value, `${where} row "${r.key}"`);
      }
    }
  }
  for (const e of payload.exceptions) {
    if (isFinanceException(e)) {
      throw new Error(`Finance exception "${e.code}" in finance-free report`);
    }
  }
}
