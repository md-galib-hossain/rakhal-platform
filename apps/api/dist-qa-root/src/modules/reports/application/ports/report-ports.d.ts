import type { ReportPeriod } from '../../domain/contracts/period';
import type { ReportScope } from '../../domain/contracts/scope';
import type { ReportSnapshotPayload } from '../../domain/contracts/snapshot';
import type { MetricId } from '../../domain/contracts/metric-definition';
import type { ReportTemplateDefinition } from '../../domain/contracts/template';
import type { ReportType } from '../../domain/contracts/enums';
export declare const REPORT_COMPUTE: unique symbol;
export declare const REPORT_QUEUE: unique symbol;
export declare const REPORT_RENDERER: unique symbol;
export interface ReportComputeInput {
    farmId: string;
    includeFinance: boolean;
    type: ReportType;
    period: ReportPeriod;
    scope: ReportScope;
    selectedMetricIds: readonly MetricId[];
    template: ReportTemplateDefinition;
    generatedAt: Date;
}
export interface ReportComputeService {
    compute(input: ReportComputeInput): Promise<ReportSnapshotPayload>;
}
export interface ReportQueue {
    enqueue(reportId: string): Promise<void>;
}
export interface ReportRenderer {
    render(payload: ReportSnapshotPayload): Promise<{
        body: Buffer;
        contentType: string;
    } | null>;
}
