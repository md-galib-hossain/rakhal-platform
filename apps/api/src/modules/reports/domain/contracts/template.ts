import type { ReportDomain, ReportType, DatePreset } from './enums';
import type { MetricId } from './metric-definition';
import type { ReportScope } from './scope';

/**
 * A versioned template (persisted as `ReportTemplateVersion`, RPT-07). Rule: users CANNOT reorder or
 * edit sections. Only the Rakhal team publishes a new version (admin-api, RPT-13); a new version
 * affects future reports only. Existing snapshots keep the version they were built with.
 */
export interface ReportTemplateDefinition {
  type: ReportType;
  version: number;
  sections: ReportTemplateSection[];
  thresholds: ReportThresholds;
}

export interface ReportTemplateSection {
  id: string;
  domain: ReportDomain;
  metricIds: MetricId[];
  /** i18n key, not display text. */
  titleKey: string;
}

export interface ReportThresholds {
  /** Existing farm setting `lactationSuddenDropThresholdPct` (default 30, EPIC_REPORTS section 3). */
  suddenDropPct: number;
  /** "Repeated" health case window (60-day rule, EPIC_REPORTS section 3). */
  repeatedCaseWindowDays: number;
  /** Max hours a scheduled run waits for unsubmitted milk drafts. TODO(owner): value N. */
  finalizationMaxWaitHours: number;
}

/** On-demand request. `selectedMetricIds` must be a subset of the template's allowed metrics. */
export interface ReportRequestConfig {
  templateId: string;
  period: {
    preset: DatePreset;
    customStartDate?: string;
    customEndDate?: string;
  };
  scope: ReportScope;
  selectedMetricIds: MetricId[];
  compare: boolean;
}

/** Pure subset check used by the API layer (RPT-08). */
export function isSubsetOfAllowed(
  selected: readonly MetricId[],
  allowed: readonly MetricId[],
): boolean {
  const set = new Set(allowed);
  return selected.every((id) => set.has(id));
}
