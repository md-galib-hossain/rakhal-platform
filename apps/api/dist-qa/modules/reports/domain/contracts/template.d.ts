import type { ReportDomain, ReportType, DatePreset } from './enums';
import type { MetricId } from './metric-definition';
import type { ReportScope } from './scope';
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
    titleKey: string;
}
export interface ReportThresholds {
    suddenDropPct: number;
    repeatedCaseWindowDays: number;
    finalizationMaxWaitHours: number;
}
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
export declare function isSubsetOfAllowed(selected: readonly MetricId[], allowed: readonly MetricId[]): boolean;
