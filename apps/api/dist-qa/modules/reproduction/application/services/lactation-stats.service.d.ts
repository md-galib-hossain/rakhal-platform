import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { totalsByDisposition } from '../../domain/lactation-yield';
import { DailyYieldPoint } from '../../domain/lactation-curve';
import { LactationPersistency } from '../../domain/lactation-persistency';
import { DimAlignedPoint, LactationComparisonGroupBy, LactationGroupBucketResult } from '../../domain/lactation-comparison';
export interface LactationComparisonSummary {
    lactationId: string;
    lactationNumber: number;
    startDate: Date;
    endDate: Date | null;
    dim: number;
    sevenDayAvgYield: number;
    thirtyDayAvgYield: number;
    lactationToDate: ReturnType<typeof totalsByDisposition>;
    peak: {
        yieldL: number;
        date: Date;
        dim: number;
    } | null;
    persistency: LactationPersistency | null;
}
export declare class LactationStatsService {
    private readonly prisma;
    private readonly logger;
    private readonly farmSettings;
    constructor(prisma: PrismaService, logger: LoggerService, farmSettings: FarmSettingsService);
    getStats(farmId: string, lactationId: string): Promise<{
        lactationId: string;
        cattleId: string;
        tagNumber: string;
        startDate: Date;
        endDate: Date | null;
        today: number;
        sevenDayAvgYield: number;
        thirtyDayAvgYield: number;
        lactationToDate: import("../../domain/lactation-yield").LactationTotalsByDisposition;
        peak: {
            yieldL: number;
            date: Date;
            dim: number;
        } | null;
        persistency: LactationPersistency | null;
        recommendedDryOffAt: Date | null;
        plannedDryOffAt: Date | null;
        managementEstimateDimRange: [number, number] | null;
        dryOffConfidence: "LOW" | null;
        dryOffProjectionReason: string | null;
        standardized305DayYield: number | null;
    }>;
    updatePlannedDryOff(farmId: string, lactationId: string, plannedDryOffAt: Date | null): Promise<{
        id: string;
        createdAt: Date;
        updatedAt: Date;
        status: import("@prisma/client").$Enums.LactationStatus;
        startDate: Date;
        endDate: Date | null;
        cattleId: string;
        lactationNumber: number;
        calvingEventId: string | null;
        peakMilkDate: Date | null;
        startReason: import("@prisma/client").$Enums.LactationStartReason;
        sourceCalvingEventId: string | null;
        endReason: import("@prisma/client").$Enums.LactationEndReason | null;
        isEstimated: boolean;
        estimatedLactationNumber: number | null;
        estimatedDaysInMilk: number | null;
        peakMilkYield: number | null;
        peakDaysInMilk: number | null;
        recommendedDryOffAt: Date | null;
        plannedDryOffAt: Date | null;
    }>;
    private resolveDryOffProjection;
    getCurve(farmId: string, lactationId: string, compareLactationId?: string): Promise<{
        lactationId: string;
        cattleId: string;
        series: DailyYieldPoint[];
        compareLactationId: string | null;
        compareCattleId: string | null;
        compareSeries: DailyYieldPoint[] | null;
    }>;
    private buildSeriesFor;
    private resolveExpectedSessions;
    private getLactationOrThrow;
    compareLactations(farmId: string, cattleId: string, byLactationNumber: boolean): Promise<{
        cattleId: string;
        tagNumber: string;
        byLactationNumber: boolean;
        current: LactationComparisonSummary;
        previous: LactationComparisonSummary | null;
        alignedSeries: DimAlignedPoint[];
    }>;
    compareGroups(farmId: string, groupBy: LactationComparisonGroupBy): Promise<LactationGroupBucketResult[]>;
    private resolveGroupBucket;
    private buildComparisonSummary;
    private getCurrentLactationOrThrow;
    private findLactationByNumber;
    private findPreviousEndedLactation;
    private lactationForAccessSelect;
    private mapLactationForAccess;
}
