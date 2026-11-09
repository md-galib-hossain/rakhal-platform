import { MilkTankActivity, MilkTankType } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class CreateMilkTankDto {
    name: string;
    tankType: MilkTankType;
    totalCapacityL: number;
    currentVolumeL?: number;
    fatPct?: number;
    proteinPct?: number;
    snfPct?: number;
    smartSensorId?: string;
    targetTempC?: number;
    agitationIntervalMin?: number;
    assignedShedId?: string;
}
export declare class UpdateMilkTankDto {
    name?: string;
    tankType?: MilkTankType;
    totalCapacityL?: number;
    fatPct?: number;
    proteinPct?: number;
    snfPct?: number;
    smartSensorId?: string;
    targetTempC?: number;
    agitationIntervalMin?: number;
    assignedShedId?: string;
}
export declare class AdjustMilkTankVolumeDto {
    delta: number;
    activityType: MilkTankActivity;
    source?: string;
    notes?: string;
    saleLineId?: string;
}
export declare class ListMilkTankQueryDto {
    tankType?: MilkTankType;
    includeArchived: boolean;
}
export declare class ListMilkTankAuditQueryDto extends CursorPaginationQueryDto {
    tankId?: string;
}
