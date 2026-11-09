import { FarmModuleSettings, MilkSession } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
export declare class FarmSettingsService {
    private readonly prisma;
    private readonly log;
    constructor(prisma: PrismaService, logger: LoggerService);
    getEffective(farmId: string): Promise<FarmModuleSettings>;
    reproVwpDays(farmId: string): Promise<number>;
    reproPregnancyCheckDays(farmId: string): Promise<number>;
    reproDryPeriodTargetDays(farmId: string): Promise<number>;
    reproHeatWindowDays(farmId: string): Promise<number>;
    reproCloseUpWindowDays(farmId: string): Promise<number>;
    lactationStageThresholds(farmId: string): Promise<{
        freshDays: number;
        earlyDays: number;
        midDays: number;
    }>;
    pregnancyStageThresholds(farmId: string): Promise<{
        earlyDays: number;
        midDays: number;
    }>;
    reproOverduePregnancyCheckDays(farmId: string): Promise<number>;
    reproRepeatBreederThreshold(farmId: string): Promise<number>;
    reproLongDaysOpenDays(farmId: string): Promise<number>;
    reproCalvingOverdueDays(farmId: string): Promise<number>;
    milkAnomalyFraction(farmId: string): Promise<number>;
    financeRunwayThresholds(farmId: string): Promise<{
        warningDays: number;
        criticalDays: number;
    }>;
    healthScoreWarningPct(farmId: string): Promise<number>;
    milkColostrumWindowDays(farmId: string): Promise<number>;
    milkActiveSessions(farmId: string): Promise<MilkSession[]>;
    minDimFor305DayYield(farmId: string): Promise<number>;
    lifecycleBoundaries(farmId: string): Promise<{
        weaningDays: number;
        growingStartDays: number;
        breedingAgeDays: number;
    }>;
    lactationSuddenDropThresholdPct(farmId: string): Promise<number>;
    lactationLongNotPregnantDimDays(farmId: string): Promise<number>;
}
