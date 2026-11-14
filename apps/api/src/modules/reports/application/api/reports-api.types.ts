import type { ReportScope } from '../../domain/contracts/scope';
import type { ReportSnapshotPayload } from '../../domain/contracts/snapshot';
import type {
  ReportErrorCategory,
  ReportOrigin,
  ReportStatus,
  ReportType,
} from '../../domain/contracts/enums';

/** Who is calling, from the verified token + farm context (never from the request body). */
export interface ReportCaller {
  userId: string;
  farmId: string;
  permissionsVersion: number;
  roleName: string;
  isSystemRole: boolean;
}

/**
 * The slice of RPT-09's `ReportLifecycleService` the API needs. Declared locally so RPT-08 compiles
 * and is tested against a fake; the module binds the real implementation to `REPORT_LIFECYCLE`.
 */
export const REPORT_LIFECYCLE = Symbol('REPORT_LIFECYCLE');
export interface ReportLifecyclePort {
  /**
   * FAILED -> QUEUED (CAS), increments `manualRetries`; when `maxManualRetries` is given it also
   * requires `manualRetries < max`. False => nothing changed.
   */
  resetForRetry(
    reportId: string,
    farmId: string,
    maxManualRetries?: number,
  ): Promise<boolean>;
}

/** Client-facing report row. Never carries a storage key, a signed URL or snapshot content. */
export interface ReportSummary {
  id: string;
  type: ReportType;
  origin: ReportOrigin;
  status: ReportStatus;
  templateVersion: number | null;
  period: { startDate: string; endDate: string; timezone: string };
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
  /** Stored snapshot, present only when COMPLETED. */
  payload: ReportSnapshotPayload | null;
}

export type CreateReportResult =
  | { duplicate: false; replayed: boolean; report: ReportSummary }
  | { duplicate: true; existing: ReportSummary };

export interface ReportDownload {
  body: Buffer;
  contentType: string;
  fileName: string;
}
