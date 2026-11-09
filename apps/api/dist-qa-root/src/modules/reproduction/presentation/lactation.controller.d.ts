import { LactationStatsService } from '../application/services/lactation-stats.service';
import { LactationEconomicsService } from '../application/services/lactation-economics.service';
import { LactationCurveQueryDto } from './dto/lactation-curve-query.dto';
import { UpdatePlannedDryOffDto } from './dto/update-planned-dry-off.dto';
import { CompareLactationQueryDto } from './dto/compare-lactation-query.dto';
import { CompareLactationGroupsQueryDto } from './dto/compare-lactation-groups-query.dto';
export declare class LactationController {
    private readonly lactationStatsService;
    private readonly lactationEconomicsService;
    constructor(lactationStatsService: LactationStatsService, lactationEconomicsService: LactationEconomicsService);
    compareLactations(farmId: string, query: CompareLactationQueryDto): Promise<{
        cattleId: string;
        tagNumber: string;
        byLactationNumber: boolean;
        current: import("../application/services/lactation-stats.service").LactationComparisonSummary;
        previous: import("../application/services/lactation-stats.service").LactationComparisonSummary | null;
        alignedSeries: import("../domain/lactation-comparison").DimAlignedPoint[];
    }>;
    compareGroups(farmId: string, query: CompareLactationGroupsQueryDto): Promise<import("../domain/lactation-comparison").LactationGroupBucketResult[]>;
    getStats(farmId: string, id: string): Promise<{
        lactationId: string;
        cattleId: string;
        tagNumber: string;
        startDate: Date;
        endDate: Date | null;
        today: number;
        sevenDayAvgYield: number;
        thirtyDayAvgYield: number;
        lactationToDate: import("../domain/lactation-yield").LactationTotalsByDisposition;
        peak: {
            yieldL: number;
            date: Date;
            dim: number;
        } | null;
        persistency: import("../domain/lactation-persistency").LactationPersistency | null;
        recommendedDryOffAt: Date | null;
        plannedDryOffAt: Date | null;
        managementEstimateDimRange: [number, number] | null;
        dryOffConfidence: "LOW" | null;
        dryOffProjectionReason: string | null;
        standardized305DayYield: number | null;
    }>;
    getCurve(farmId: string, id: string, query: LactationCurveQueryDto): Promise<{
        lactationId: string;
        cattleId: string;
        series: import("../domain/lactation-curve").DailyYieldPoint[];
        compareLactationId: string | null;
        compareCattleId: string | null;
        compareSeries: import("../domain/lactation-curve").DailyYieldPoint[] | null;
    }>;
    getEconomics(farmId: string, id: string): Promise<{
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
            lactationToDate: import("../domain/lactation-yield").LactationTotalsByDisposition;
            peak: {
                yieldL: number;
                date: Date;
                dim: number;
            } | null;
            persistency: import("../domain/lactation-persistency").LactationPersistency | null;
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
    updatePlannedDryOff(farmId: string, id: string, dto: UpdatePlannedDryOffDto): Promise<{
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
}
