import type { ReportScope } from '../../domain/contracts/scope';
import type { ReportSnapshotPayload } from '../../domain/contracts/snapshot';
import type { ReportErrorCategory, ReportOrigin, ReportStatus, ReportType } from '../../domain/contracts/enums';
export interface ReportCaller {
    userId: string;
    farmId: string;
    permissionsVersion: number;
    roleName: string;
    isSystemRole: boolean;
}
export declare const REPORT_LIFECYCLE: unique symbol;
export interface ReportLifecyclePort {
    resetForRetry(reportId: string, farmId: string, maxManualRetries?: number): Promise<boolean>;
}
export interface ReportSummary {
    id: string;
    type: ReportType;
    origin: ReportOrigin;
    status: ReportStatus;
    templateVersion: number | null;
    period: {
        startDate: string;
        endDate: string;
        timezone: string;
    };
    scope: ReportScope;
    selectedMetricIds: string[];
    includesFinance: boolean;
    hasPdf: boolean;
    pdfBytes: number | null;
    attempts: number;
    errorCategory: ReportErrorCategory | null;
    errorMessage: string | null;
    createdAt: Date;
    startedAt: Date | null;
    completedAt: Date | null;
    expiresAt: Date | null;
}
export interface ReportDetail extends ReportSummary {
    payload: ReportSnapshotPayload | null;
}
export type CreateReportResult = {
    duplicate: false;
    replayed: boolean;
    report: ReportSummary;
} | {
    duplicate: true;
    existing: ReportSummary;
};
export interface ReportDownload {
    body: Buffer;
    contentType: string;
    fileName: string;
}
