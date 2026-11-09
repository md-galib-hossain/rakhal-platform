import { HealthActionType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
export declare const PROTOCOL_OUT_OF_STOCK = "PROTOCOL_OUT_OF_STOCK";
export interface StockShortfall {
    medicineId: string | null;
    medicineName: string;
    needed: number;
    available: number;
    unit: string;
}
interface StepLike {
    actionType: HealthActionType;
    medicineId?: string | null;
    medicineName?: string | null;
    doseAmount?: unknown;
    doseUnitId?: string | null;
}
export declare class ProtocolStockService {
    private readonly prisma;
    constructor(prisma: PrismaService);
    validateAndNormalizeSteps<T extends StepLike>(farmId: string, steps: T[]): Promise<T[]>;
    check(farmId: string, steps: StepLike[], animalCount: number): Promise<StockShortfall[]>;
    assertInStock(farmId: string, steps: StepLike[], animalCount: number): Promise<void>;
}
export {};
