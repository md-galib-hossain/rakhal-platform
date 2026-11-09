import { SemenType, TargetSex } from '@prisma/client';
import { CursorPaginationQueryDto } from 'src/common/pagination';
export declare class CreateSemenBatchDto {
    name: string;
    batchCode?: string;
    bullId?: string;
    breed?: string;
    strawColor?: string;
    initialVitalityPct?: number;
    strawQuantity: number;
    lowStrawThreshold?: number;
    costPerUnit: number;
    semenType?: SemenType;
    targetSex?: TargetSex;
    fatherId?: string;
    motherId?: string;
    tankId?: string;
    canister?: string;
    cane?: string;
    goblet?: string;
    notes?: string;
}
export declare class UpdateSemenBatchDto {
    name?: string;
    batchCode?: string;
    bullId?: string;
    breed?: string;
    strawColor?: string;
    initialVitalityPct?: number;
    strawQuantity?: number;
    lowStrawThreshold?: number;
    costPerUnit?: number;
    semenType?: SemenType;
    targetSex?: TargetSex;
    tankId?: string;
    canister?: string;
    goblet?: string;
    notes?: string;
}
export declare class ListSemenBatchQueryDto extends CursorPaginationQueryDto {
    search?: string;
    tankId?: string;
    includeArchived: boolean;
}
