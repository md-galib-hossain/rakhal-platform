import type { DataQuality } from '../contracts/data-quality';
import type { MetricValue } from '../contracts/metric-value';
export type Coverage = DataQuality['coverage'];
export declare const DQ_NOTE: {
    readonly incompleteCoverage: "reports.dq.incomplete_coverage";
    readonly unsubmittedDrafts: "reports.dq.unsubmitted_drafts_excluded";
    readonly estimatedValues: "reports.dq.estimated_values";
    readonly unknownCosts: "reports.dq.unknown_costs";
    readonly groupMembershipCurrentOnly: "reports.dq.group_membership_as_of_generation";
    readonly entryDateProxy: "reports.dq.entry_date_created_at_proxy";
    readonly noExpectedData: "reports.dq.no_expected_data";
    readonly scopeEmpty: "reports.dq.scope_empty";
};
export declare function buildCoverage(expected: number | Iterable<string>, recorded: number | Iterable<string>): Coverage;
export declare function coverageRatio(c: Coverage): number | null;
export declare function isIncompleteCoverage(c: Coverage): boolean;
export declare function missingKeys(expected: Iterable<string>, recorded: Iterable<string>): string[];
export declare function valueOrMissing(amount: number | null | undefined, unit: string, reason: string): MetricValue;
export interface DataQualityInput {
    coverage: Coverage;
    hasUnsubmittedDrafts?: boolean;
    hasEstimatedValues?: boolean;
    hasUnknownCosts?: boolean;
    groupMembershipCurrentOnly?: boolean;
    usesCreatedAtProxy?: boolean;
    scopeEmpty?: boolean;
}
export declare function buildDataQuality(input: DataQualityInput): DataQuality;
