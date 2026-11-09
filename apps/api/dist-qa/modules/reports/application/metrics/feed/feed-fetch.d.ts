import type { ReportPeriod } from '../../../domain/contracts/period';
import type { ReportDb } from '../metric-context';
import type { LowStockInput, RawFeedData } from './feed-aggregation';
export interface FeedFetchArgs {
    db: ReportDb;
    farmId: string;
    timezone: string;
    cattleIds: readonly string[];
    includeFinance: boolean;
}
export declare function localDayKey(d: Date, timezone: string): string;
export declare function fetchPeriodRaw(a: FeedFetchArgs, period: ReportPeriod): Promise<RawFeedData>;
export declare function fetchLowStockInputs(db: ReportDb, farmId: string): Promise<LowStockInput[]>;
