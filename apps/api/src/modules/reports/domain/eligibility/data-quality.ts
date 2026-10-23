import type { DataQuality, DataQualityFlags } from '../contracts/data-quality';
import type { MetricValue } from '../contracts/metric-value';

export type Coverage = DataQuality['coverage'];

/** i18n keys for DataQuality.notes (frontend/PDF translate). */
export const DQ_NOTE = {
  incompleteCoverage: 'reports.dq.incomplete_coverage',
  unsubmittedDrafts: 'reports.dq.unsubmitted_drafts_excluded',
  estimatedValues: 'reports.dq.estimated_values',
  unknownCosts: 'reports.dq.unknown_costs',
  groupMembershipCurrentOnly: 'reports.dq.group_membership_as_of_generation',
  entryDateProxy: 'reports.dq.entry_date_created_at_proxy',
  noExpectedData: 'reports.dq.no_expected_data',
  scopeEmpty: 'reports.dq.scope_empty',
} as const;

/**
 * Coverage from two counts or two item collections. For collections, `recorded` counts only
 * recorded items that are also expected (extras never inflate coverage), de-duplicated.
 */
export function buildCoverage(
  expected: number | Iterable<string>,
  recorded: number | Iterable<string>,
): Coverage {
  if (typeof expected === 'number' && typeof recorded === 'number') {
    return { expected: Math.max(0, expected), recorded: Math.max(0, recorded) };
  }
  if (typeof expected === 'number' || typeof recorded === 'number') {
    throw new TypeError('buildCoverage: pass both counts or both collections');
  }
  const exp = new Set(expected);
  const rec = new Set(recorded);
  let n = 0;
  for (const k of rec) if (exp.has(k)) n++;
  return { expected: exp.size, recorded: n };
}

/** recorded/expected in [0,1]; null when nothing was expected (never NaN/Infinity). */
export function coverageRatio(c: Coverage): number | null {
  if (c.expected <= 0) return null;
  return Math.min(1, c.recorded / c.expected);
}

export function isIncompleteCoverage(c: Coverage): boolean {
  return c.expected > 0 && c.recorded < c.expected;
}

/** Keys expected but not recorded. A day with no row is missing, never 0. */
export function missingKeys(
  expected: Iterable<string>,
  recorded: Iterable<string>,
): string[] {
  const rec = new Set(recorded);
  return Array.from(new Set(expected)).filter((k) => !rec.has(k));
}

/** No row = missing; a row with 0 = value 0. Null/NaN amounts are missing too. */
export function valueOrMissing(
  amount: number | null | undefined,
  unit: string,
  reason: string,
): MetricValue {
  if (typeof amount !== 'number' || !Number.isFinite(amount))
    return { state: 'missing', reason };
  return { state: 'value', value: amount, unit };
}

export interface DataQualityInput {
  coverage: Coverage;
  hasUnsubmittedDrafts?: boolean;
  hasEstimatedValues?: boolean;
  hasUnknownCosts?: boolean;
  groupMembershipCurrentOnly?: boolean;
  usesCreatedAtProxy?: boolean;
  scopeEmpty?: boolean;
}

export function buildDataQuality(input: DataQualityInput): DataQuality {
  const flags: DataQualityFlags = {
    incompleteCoverage: isIncompleteCoverage(input.coverage),
    hasUnsubmittedDrafts: !!input.hasUnsubmittedDrafts,
    hasEstimatedValues:
      !!input.hasEstimatedValues || !!input.usesCreatedAtProxy,
    hasUnknownCosts: !!input.hasUnknownCosts,
    groupMembershipCurrentOnly: !!input.groupMembershipCurrentOnly,
  };
  const notes: string[] = [];
  if (input.scopeEmpty) notes.push(DQ_NOTE.scopeEmpty);
  else if (input.coverage.expected <= 0) notes.push(DQ_NOTE.noExpectedData);
  if (flags.incompleteCoverage) notes.push(DQ_NOTE.incompleteCoverage);
  if (flags.hasUnsubmittedDrafts) notes.push(DQ_NOTE.unsubmittedDrafts);
  if (input.usesCreatedAtProxy) notes.push(DQ_NOTE.entryDateProxy);
  if (input.hasEstimatedValues) notes.push(DQ_NOTE.estimatedValues);
  if (flags.hasUnknownCosts) notes.push(DQ_NOTE.unknownCosts);
  if (flags.groupMembershipCurrentOnly)
    notes.push(DQ_NOTE.groupMembershipCurrentOnly);
  return { coverage: input.coverage, notes, flags };
}
