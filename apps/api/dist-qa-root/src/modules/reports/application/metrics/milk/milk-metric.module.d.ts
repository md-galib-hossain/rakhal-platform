import type { DomainMetricModule, DomainMetricOutput, MetricContext } from '../metric-context';
import { evaluateSuddenDrops, type MilkAggregate, type MilkRow } from './milk-aggregation';
export declare const MILK_REASON: {
    readonly noRows: "reports.milk.no_submitted_rows";
    readonly noRecordedCowDays: "reports.milk.no_recorded_cow_days";
    readonly noRowsForDay: "reports.milk.no_rows_for_day";
    readonly noRowsForCow: "reports.milk.no_rows_for_cow";
    readonly noCompleteData: "reports.milk.no_complete_data_for_drop_check";
    readonly noExpectedDays: "reports.milk.expected_days_unknown";
};
export declare function buildMilkOutput(args: {
    current: MilkAggregate;
    previous: MilkAggregate | null;
    currentRows: readonly MilkRow[];
    draftCount: number;
    expectedSessions: Parameters<typeof evaluateSuddenDrops>[0]['expectedSessions'];
    ctx: Pick<MetricContext, 'cattleIds' | 'thresholds'>;
}): DomainMetricOutput;
export declare const milkMetricModule: DomainMetricModule;
