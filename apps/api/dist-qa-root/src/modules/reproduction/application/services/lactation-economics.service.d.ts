import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { LactationStatsService } from './lactation-stats.service';
export declare class LactationEconomicsService {
    private readonly prisma;
    private readonly logger;
    private readonly lactationStatsService;
    constructor(prisma: PrismaService, logger: LoggerService, lactationStatsService: LactationStatsService);
    getEconomics(farmId: string, lactationId: string): Promise<{
        lactationId: string;
        cattleId: string;
        tagNumber: string;
        startDate: Date;
        endDate: Date | null;
        biological: {
            dim: number;
            today: number;
            sevenDayAvgYield: number;
            thirtyDayAvgYield: number;
            lactationToDate: import("../../domain/lactation-yield").LactationTotalsByDisposition;
            peak: {
                yieldL: number;
                date: Date;
                dim: number;
            } | null;
            persistency: import("../../domain/lactation-persistency").LactationPersistency | null;
        };
        financial: {
            effectiveMilkRatePerLitre: number;
            saleableLitres: number;
            withheldLitres: number;
            discardedLitres: number;
            totalCost: number;
            margin: number;
            milkRevenue: number;
            feedCost: number;
            medicineCost: number;
            breedingCost: number;
            discardedWithheldValue: number;
        };
        assumptions: string[];
    }>;
    private resolveEffectiveMilkRate;
    private computeAllocatedFeedCost;
    private getLactationOrThrow;
}
