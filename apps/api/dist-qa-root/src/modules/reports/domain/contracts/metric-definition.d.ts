import type { ReportDomain } from './enums';
export type MetricId = `${ReportDomain}.${string}`;
export type ReportPermission = 'finance.read';
export interface MetricDefinition {
    id: MetricId;
    domain: ReportDomain;
    unit: string;
    formula: string;
    eligibilityRule: string;
    missingDataRule: string;
    requiresPermission?: ReportPermission;
    calcVersion: number;
}
export type MetricRegistry = Readonly<Record<string, MetricDefinition>>;
