import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export interface MilkTankAvailability {
    tankId: string;
    tankName: string;
    availableL: number;
    totalCapacityL: number;
}
export interface MilkAvailabilityResult {
    tanks: MilkTankAvailability[];
    totalAvailableL: number;
}
export declare class MilkAvailabilityService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    getAvailability(farmId: string, tankId?: string): Promise<MilkAvailabilityResult>;
    lockAndValidate(farmId: string, tankId: string, requiredVolumeL: number, tx: Prisma.TransactionClient): Promise<{
        id: string;
        currentVolumeL: number;
    }>;
    private present;
}
