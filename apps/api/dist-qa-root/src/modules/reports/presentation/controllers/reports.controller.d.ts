import type { Response } from 'express';
import { ReportsApiService } from '../../application/api/reports-api.service';
import type { ReportCaller } from '../../application/api/reports-api.types';
import { CreateReportDto, ListReportsQueryDto, PreviewReportDto, ReportIdParamDto } from '../dto/reports.dto';
export declare class ReportsController {
    private readonly reports;
    constructor(reports: ReportsApiService);
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
                metrics: {
                    id: string;
                    unit: string;
                    labelKey: string;
                    definitionKey: string;
                    requiresFinance: boolean;
                }[];
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
    preview(caller: ReportCaller, dto: PreviewReportDto): Promise<import("../../domain/contracts").ReportSnapshotPayload>;
    create(caller: ReportCaller, dto: CreateReportDto, idempotencyKey: string | undefined, res: Response): Promise<{
        duplicate: boolean;
        existing: import("../../application/api/reports-api.types").ReportSummary;
        replayed?: undefined;
        report?: undefined;
    } | {
        duplicate: boolean;
        replayed: boolean;
        report: import("../../application/api/reports-api.types").ReportSummary;
        existing?: undefined;
    }>;
    list(caller: ReportCaller, query: ListReportsQueryDto): Promise<{
        items: import("../../application/api/reports-api.types").ReportSummary[];
        meta: import("../../../../common/pagination").CursorPageMeta;
    }>;
    getOne(caller: ReportCaller, { id }: ReportIdParamDto): Promise<import("../../application/api/reports-api.types").ReportDetail>;
    download(caller: ReportCaller, { id }: ReportIdParamDto, res: Response): Promise<void>;
    retry(caller: ReportCaller, { id }: ReportIdParamDto): Promise<import("../../application/api/reports-api.types").ReportSummary>;
    remove(caller: ReportCaller, { id }: ReportIdParamDto): Promise<{
        deleted: true;
    }>;
}
