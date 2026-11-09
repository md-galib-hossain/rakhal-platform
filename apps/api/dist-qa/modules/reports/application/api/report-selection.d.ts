import type { MetricDefinition, MetricId, MetricRegistry } from '../../domain/contracts/metric-definition';
import { type ReportTemplateDefinition } from '../../domain/contracts/template';
import type { ReportScope } from '../../domain/contracts/scope';
export declare const isFinanceMetric: (def: MetricDefinition) => boolean;
export declare function allowedMetricIds(template: ReportTemplateDefinition, registry: MetricRegistry): MetricId[];
export declare function validateMetricSelection(input: {
    requested: readonly string[];
    allowed: readonly MetricId[];
    registry: MetricRegistry;
    canFinance: boolean;
    max?: number;
}): MetricId[];
export declare function scopeIdentity(scope: ReportScope): string;
export declare function sameMetricSet(a: readonly string[], b: readonly string[]): boolean;
