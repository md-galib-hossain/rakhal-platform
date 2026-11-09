import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { AqrService } from 'src/modules/activity/application/services/aqr.service';
import { ActivityLogService } from 'src/modules/activity/application/services/activity-log.service';
import { MilkTankService } from 'src/modules/inventory/application/services/milk-tank.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { HealthService } from 'src/modules/health/application/services/health.service';
import { AnimalHoldService } from 'src/modules/cattle/application/services/animal-hold.service';
import { MilkEligibility } from '../../domain/milk-eligibility';
import { MilkAnomalyQueryDto, MilkLogQueryDto, MilkTrendRange } from '../../presentation/dto/milk-query.dto';
import { ReviewAnomalyDto } from '../../presentation/dto/review-anomaly.dto';
import { SaveMilkLogDto } from '../../presentation/dto/save-milk-log.dto';
import { SubmitMilkDto } from '../../presentation/dto/submit-milk.dto';
export declare class MilkService {
    private readonly prisma;
    private readonly aqrService;
    private readonly activityLog;
    private readonly milkTankService;
    private readonly farmSettings;
    private readonly healthService;
    private readonly animalHoldService;
    private readonly clock;
    private readonly log;
    constructor(prisma: PrismaService, aqrService: AqrService, activityLog: ActivityLogService, milkTankService: MilkTankService, farmSettings: FarmSettingsService, healthService: HealthService, animalHoldService: AnimalHoldService, logger: LoggerService, clock: FarmClockService);
    overview(farmId: string, dateStr?: string, range?: MilkTrendRange): Promise<{
        date: string;
        today: {
            totalL: number;
            sellableL: number;
            withholdingL: number;
            calfL: number;
        };
        yesterday: {
            totalL: number;
        };
        sameDayLastWeek: {
            totalL: number;
        };
        sameDayLastYear: {
            totalL: number;
        };
        costPerLitreToday: null;
        marketValueToday: number | null;
        sessionsStatus: Record<string, string>;
        trendRange: "30d" | "lifetime" | "7d" | "3m" | "6m" | "1y";
        trend: {
            date: string;
            totalL: number;
        }[];
    }>;
    private estimatedMilkPricePerLitre;
    logTable(farmId: string, query: MilkLogQueryDto): Promise<{
        date: string;
        sessionConfig: import("@prisma/client").$Enums.MilkSession[];
        entries: {
            cattleId: string;
            name: string | null;
            tag: string;
            shed: string | null;
            avgYield7d: number | null;
            prevDayYieldL: number | null;
            productionStatus: string;
            withholding: boolean;
            log: {
                morningL: number | null;
                noonL: number | null;
                eveningL: number | null;
                nightL: number | null;
                totalL: number;
                tank: "SELLABLE" | "WITHHOLDING";
                tankLocked: boolean;
                tankId: string | null;
                anomalyFlag: boolean;
                submittedSessions: import("@prisma/client").$Enums.MilkSession[];
                dispositions: {
                    [k: string]: import("@prisma/client").$Enums.MilkDisposition;
                };
            };
        }[];
    }>;
    getMilkEligibility(farmId: string, cattleId: string): Promise<MilkEligibility>;
    saveLog(farmId: string, userId: string, dto: SaveMilkLogDto): Promise<{
        saved: number;
        anomaliesFlagged: number;
        sessionTotalL: number;
    }>;
    submit(farmId: string, userId: string, dto: SubmitMilkDto): Promise<{
        date: string;
        session: import("@prisma/client").$Enums.MilkSession;
        totalCowsLogged: number;
        sellableTotalL: number;
        withholdingTotalL: number;
        mainTankUpdated: boolean;
        withholdingTankUpdated: boolean;
        activityLogCreated: boolean;
        anomalies: {
            cattleId: string;
            name: string;
            yieldL: number;
        }[];
    }>;
    logCalendar(farmId: string, month: string): Promise<{
        month: string;
        days: {
            date: string;
            status: "complete" | "partial" | "missing" | "future" | "before_farm";
        }[];
    }>;
    anomalies(farmId: string, query: MilkAnomalyQueryDto): Promise<{
        items: {
            id: string;
            cattleId: string;
            name: string;
            tag: string;
            date: string;
            session: import("@prisma/client").$Enums.MilkSession;
            yieldL: number;
            avg7dL: number | null;
            dropPct: number | null;
            workerNote: string | null;
            reviewed: boolean;
        }[];
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
    reviewAnomaly(farmId: string, id: string, dto: ReviewAnomalyDto): Promise<{
        farmId: string;
        session: import("@prisma/client").$Enums.MilkSession;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        cattleId: string;
        createdBy: string;
        disposition: import("@prisma/client").$Enums.MilkDisposition;
        tankId: string | null;
        tankType: import("@prisma/client").$Enums.MilkTankType;
        submitted: boolean;
        yieldL: number;
        logDate: Date;
        anomalyFlag: boolean;
        anomalyNote: string | null;
        reviewed: boolean;
        reviewAction: string | null;
        reviewNote: string | null;
        submittedAt: Date | null;
        editReason: string | null;
    }>;
    private assertSessionActive;
    private collectInto;
    private recomputeLactationPeak;
    private activeWithholding;
    averageDailyYield(farmId: string, cattleIds: string[], asOf?: Date): Promise<Map<string, number>>;
    private avgDailyYield;
    private prevDayYield;
    private sessionAvg;
    private dayBreakdown;
    private dayTotal;
    private sessionStatuses;
    private trend;
    private sum;
    private normalizeDate;
    private shiftDays;
    private dateOnly;
}
