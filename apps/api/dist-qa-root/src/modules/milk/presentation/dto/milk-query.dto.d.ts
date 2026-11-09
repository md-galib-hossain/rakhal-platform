import { MilkSession } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare const MILK_TREND_RANGES: readonly ["7d", "30d", "3m", "6m", "1y", "lifetime"];
export type MilkTrendRange = (typeof MILK_TREND_RANGES)[number];
export declare class MilkOverviewQueryDto {
    date?: string;
    range?: MilkTrendRange;
}
export declare class MilkLogQueryDto {
    date?: string;
    shedId?: string;
    session?: MilkSession;
}
export declare class MilkAnomalyQueryDto extends CursorPaginationQueryDto {
    date?: string;
}
export declare class MilkAvailabilityQueryDto {
    tankId?: string;
}
