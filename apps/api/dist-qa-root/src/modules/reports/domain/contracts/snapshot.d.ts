import type { ReportDomain, ReportType } from './enums';
import type { ReportPeriod } from './period';
import type { ReportScope } from './scope';
import type { MetricResult } from './metric-value';
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
    messageKey: string;
    cattleIds?: string[];
}
export interface ReportSnapshotPayload {
    schemaVersion: number;
    reportType?: ReportType;
    calcVersion: number;
    templateVersion: number;
    farm: {
        id: string;
        name: string;
        timezone: string;
        logoKey?: string | null;
    };
    period: ReportPeriod;
    previousPeriod?: ReportPeriod;
    scope: ReportScope;
    generatedAt: string;
    includesFinance: boolean;
    sections: SnapshotSection[];
    exceptions: ReportException[];
    dataQuality: DataQuality;
}
export declare const FINANCE_SOURCE_DENYLIST: readonly string[];
export declare function assertNoFinance(payload: ReportSnapshotPayload): void;
