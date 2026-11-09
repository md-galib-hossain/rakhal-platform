import { MilkSession } from '@prisma/client';
import type { ReportDb } from '../metric-context';
import type { MilkRow } from './milk-aggregation';
export declare function fetchSubmittedMilkRows(db: ReportDb, args: {
    farmId: string;
    cattleIds: readonly string[];
    from: string;
    to: string;
}): Promise<MilkRow[]>;
export declare function countUnsubmittedDrafts(db: ReportDb, args: {
    farmId: string;
    cattleIds: readonly string[];
    from: string;
    to: string;
}): Promise<number>;
export declare function fetchExpectedSessions(db: ReportDb, farmId: string): Promise<MilkSession[]>;
