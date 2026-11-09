import { type Money } from 'src/common/money';
import type { ReportDb } from '../metric-context';
import type { ReportPeriod } from '../../../domain/contracts/period';
import type { ServiceRow } from './repro-aggregation';
export type NotHistorical = {
    OR: [{
        animalEventId: null;
    }, {
        animalEventId: {
            notIn: string[];
        };
    }];
} | Record<string, never>;
export declare function notHistoricalClause(db: ReportDb, farmId: string): Promise<NotHistorical>;
export declare function fetchCohortServices(db: ReportDb, farmId: string, cattleIds: readonly string[], period: ReportPeriod, notHistorical?: NotHistorical): Promise<ServiceRow[]>;
export declare function fetchPendingServices(db: ReportDb, farmId: string, cattleIds: readonly string[], notHistorical?: NotHistorical): Promise<ServiceRow[]>;
export interface CalvingCounts {
    calvings: number;
    calves: number;
}
export declare function fetchCalvings(db: ReportDb, farmId: string, cattleIds: readonly string[], period: ReportPeriod, notHistorical?: NotHistorical): Promise<CalvingCounts>;
export declare function fetchAbortions(db: ReportDb, farmId: string, cattleIds: readonly string[], period: ReportPeriod, notHistorical?: NotHistorical): Promise<number>;
export declare function fetchExpectedCalvings(db: ReportDb, farmId: string, cattleIds: readonly string[], from: Date, to: Date): Promise<number>;
export declare function fetchLinkedExpenses(db: ReportDb, farmId: string, expenseIds: readonly string[]): Promise<Money[]>;
