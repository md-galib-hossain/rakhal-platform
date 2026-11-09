import type { Response } from 'express';
import { MilkAvailabilityService } from '../../application/services/milk-availability.service';
import { MilkExportService } from '../../application/services/milk-export.service';
import { MilkImportService } from '../../application/services/milk-import.service';
import { MilkQualityService } from '../../application/services/milk-quality.service';
import { MilkService } from '../../application/services/milk.service';
import { CreateMilkQualityTestDto } from '../dto/create-milk-quality-test.dto';
import { ExportMilkLogDto } from '../dto/export-milk-log.dto';
import { ImportMilkConfirmDto } from '../dto/import-milk.dto';
import { MilkLogCalendarQueryDto } from '../dto/milk-log-calendar-query.dto';
import { LatestMilkQualityTestQueryDto, ListMilkQualityTestQueryDto } from '../dto/list-milk-quality-test-query.dto';
import { MilkAnomalyQueryDto, MilkAvailabilityQueryDto, MilkLogQueryDto, MilkOverviewQueryDto } from '../dto/milk-query.dto';
import { ReviewAnomalyDto } from '../dto/review-anomaly.dto';
import { SaveMilkLogDto } from '../dto/save-milk-log.dto';
import { SubmitMilkDto } from '../dto/submit-milk.dto';
export declare class MilkController {
    private readonly milkService;
    private readonly importService;
    private readonly exportService;
    private readonly milkQualityService;
    private readonly milkAvailabilityService;
    constructor(milkService: MilkService, importService: MilkImportService, exportService: MilkExportService, milkQualityService: MilkQualityService, milkAvailabilityService: MilkAvailabilityService);
    availability(farmId: string, query: MilkAvailabilityQueryDto): Promise<import("../../application/services/milk-availability.service").MilkAvailabilityResult>;
    overview(farmId: string, query: MilkOverviewQueryDto): Promise<{
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
    logCalendar(farmId: string, query: MilkLogCalendarQueryDto): Promise<{
        month: string;
        days: {
            date: string;
            status: "complete" | "partial" | "missing" | "future" | "before_farm";
        }[];
    }>;
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
    eligibility(farmId: string, id: string): Promise<import("../../domain/milk-eligibility").MilkEligibility>;
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
        meta: import("../../../../common/pagination").CursorPageMeta;
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
    importPreview(farmId: string, file: Express.Multer.File): Promise<{
        importSessionId: `${string}-${string}-${string}-${string}-${string}`;
        total: number;
        ready: number;
        errors: number;
        rows: {
            row: number;
            date: string | null;
            tag: string | null;
            status: "error" | "ready";
            error: string | undefined;
        }[];
    }>;
    importConfirm(farmId: string, userId: string, dto: ImportMilkConfirmDto): Promise<{
        imported: number;
        skipped: number;
        failedGroups: number;
    }>;
    exportLog(farmId: string, dto: ExportMilkLogDto, res: Response): Promise<void>;
    createQualityTest(farmId: string, userId: string, dto: CreateMilkQualityTestDto): Promise<{
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        cattleId: string;
        notes: string | null;
        createdBy: string;
        source: import("@prisma/client").$Enums.MilkQualityTestSource;
        fatPct: number;
        proteinPct: number;
        lactationId: string;
        sampleDate: Date;
        lactosePct: number | null;
        somaticCellCount: number | null;
        milkUreaNitrogen: number | null;
    }>;
    latestQualityTest(farmId: string, query: LatestMilkQualityTestQueryDto): Promise<{
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        cattleId: string;
        notes: string | null;
        createdBy: string;
        source: import("@prisma/client").$Enums.MilkQualityTestSource;
        fatPct: number;
        proteinPct: number;
        lactationId: string;
        sampleDate: Date;
        lactosePct: number | null;
        somaticCellCount: number | null;
        milkUreaNitrogen: number | null;
    } | null>;
    listQualityTests(farmId: string, query: ListMilkQualityTestQueryDto): Promise<import("../../../../common/pagination").CursorPage<{
        farmId: string;
        id: string;
        createdAt: Date;
        updatedAt: Date;
        cattleId: string;
        notes: string | null;
        createdBy: string;
        source: import("@prisma/client").$Enums.MilkQualityTestSource;
        fatPct: number;
        proteinPct: number;
        lactationId: string;
        sampleDate: Date;
        lactosePct: number | null;
        somaticCellCount: number | null;
        milkUreaNitrogen: number | null;
    }>>;
}
