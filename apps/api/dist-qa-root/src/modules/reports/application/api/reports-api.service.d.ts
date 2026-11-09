import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { AuditService } from 'src/modules/audit/application/services/audit.service';
import { type ObjectStoragePort } from 'src/modules/media/application/ports/object-storage.port';
import { PermissionService } from 'src/modules/permission/application/services/permission.service';
import { DATE_PRESETS, REPORT_SCOPE_KINDS } from '../../domain/contracts/enums';
import { type ReportSnapshotPayload } from '../../domain/contracts/snapshot';
import { type ReportComputeService, type ReportQueue } from '../ports/report-ports';
import { type CreateReportResult, type ReportCaller, type ReportDetail, type ReportDownload, type ReportLifecyclePort, type ReportSummary } from './reports-api.types';
export interface ReportConfigInput {
    templateId: string;
    period: {
        preset: (typeof DATE_PRESETS)[number];
        customStartDate?: string;
        customEndDate?: string;
    };
    scope: {
        kind: (typeof REPORT_SCOPE_KINDS)[number];
        cattleId?: string;
        groupId?: string;
    };
    selectedMetricIds: string[];
    compare?: boolean;
    forceNew?: boolean;
}
export interface ReportListFilters {
    limit: number;
    cursor?: string;
    sortOrder: 'asc' | 'desc';
    type?: 'WEEKLY' | 'MONTHLY' | 'ON_DEMAND';
    origin?: 'SCHEDULED' | 'ON_DEMAND';
    status?: 'QUEUED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
}
export declare class ReportsApiService {
    private readonly prisma;
    private readonly permissions;
    private readonly farmClock;
    private readonly audit;
    private readonly logger;
    private readonly storage;
    private readonly lifecycle;
    private readonly compute;
    private readonly queue;
    private readonly log;
    private readonly previewLimiter;
    constructor(prisma: PrismaService, permissions: PermissionService, farmClock: FarmClockService, audit: AuditService, logger: LoggerService, storage: ObjectStoragePort, lifecycle: ReportLifecyclePort, compute: ReportComputeService, queue: ReportQueue);
    templates(caller: ReportCaller): Promise<{
        onDemand: {
            id: string;
            alias: string;
            version: number;
            domains: ("reproduction" | "health" | "milk" | "feed" | "finance" | "cow_profile")[];
            sections: {
                id: string;
                domain: string;
                titleKey: string;
                metrics: Array<{
                    id: string;
                    unit: string;
                    labelKey: string;
                    definitionKey: string;
                    requiresFinance: boolean;
                }>;
            }[];
        };
        scheduled: {
            weekly: {
                version: number;
            } | null;
            monthly: {
                version: number;
            } | null;
        };
        datePresets: ("custom" | "today" | "this_week" | "this_month" | "this_year")[];
        scopeKinds: ("GROUP" | "SINGLE_COW" | "ALL_ELIGIBLE")[];
        limits: {
            maxMetrics: number;
            maxCustomRangeDays: number;
        };
    }>;
    preview(caller: ReportCaller, dto: ReportConfigInput): Promise<ReportSnapshotPayload>;
    create(caller: ReportCaller, dto: ReportConfigInput, idempotencyKey?: string): Promise<CreateReportResult>;
    list(caller: ReportCaller, query: ReportListFilters): Promise<{
        items: ReportSummary[];
        meta: import("src/common/pagination").CursorPageMeta;
    }>;
    getOne(caller: ReportCaller, id: string): Promise<ReportDetail>;
    download(caller: ReportCaller, id: string): Promise<ReportDownload>;
    retry(caller: ReportCaller, id: string): Promise<ReportSummary>;
    remove(caller: ReportCaller, id: string): Promise<{
        deleted: true;
    }>;
    isOwner(caller: ReportCaller): boolean;
    private canFinance;
    private visibleWhere;
    private notFound;
    private idempotencyConflict;
    private assertInFlightCapacity;
    private requestHash;
    private latestTemplateRow;
    private latestTemplate;
    private prepare;
    private resolveScope;
    private resolvePeriod;
    private normaliseIdempotencyKey;
    private findByIdempotencyKey;
    private findDuplicate;
    private toSummary;
    private fileName;
    private auditSafe;
}
