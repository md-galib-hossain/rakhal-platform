import type { ReportDomain } from './enums';

/**
 * Metric ids are `<domain>.<name>`. Each domain's metric module owns and exports its own
 * MetricDefinition[] (RPT-04/05/06); the registry is assembled from them, so no shared id list is
 * edited by parallel agents.
 */
export type MetricId = `${ReportDomain}.${string}`;

/** Permission strings gating a metric. `finance.read` per EPIC_REPORTS section 4; others TODO(owner). */
export type ReportPermission = 'finance.read';

export interface MetricDefinition {
  id: MetricId;
  domain: ReportDomain;
  unit: string;
  /** Human-readable formula. */
  formula: string;
  /** Which cows/rows count (e.g. "cow present on any day in period"). */
  eligibilityRule: string;
  /** What is shown when inputs are absent (must map to a non-`value` MetricValue state). */
  missingDataRule: string;
  requiresPermission?: ReportPermission;
  /** Bump when the calculation changes; stored on every snapshot. */
  calcVersion: number;
}

export type MetricRegistry = Readonly<Record<string, MetricDefinition>>;
