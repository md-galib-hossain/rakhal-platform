import { Injectable } from '@nestjs/common';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import type { ReportErrorCategory } from '../../domain/contracts/enums';
import {
  DEFAULT_REPORT_RETENTION_DAYS,
  REPORT_PROCESSING_LEASE_MS,
  SAFE_ERROR_MESSAGE,
} from './report-pipeline.constants';

export type ClaimResult =
  | { claimed: true; token: Date }
  | { claimed: false; retryAfterMs: number | null };

export interface ArtifactInfo {
  key: string;
  bytes: number;
  contentType: string;
}

/**
 * Every Report status transition, as a conditional `updateMany` (compare-and-set on `status`).
 * COMPLETED and FAILED are only ever left through `resetForRetry` (FAILED -> QUEUED, explicit user
 * action); no automatic path can overwrite them.
 */
@Injectable()
export class ReportLifecycleService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReportLifecycleService.name);
  }

  /**
   * QUEUED -> PROCESSING, or re-claim of a PROCESSING row whose lease expired (dead worker).
   * On success returns the claim token (the new `startedAt`): every later transition must present
   * it, so a slow worker whose lease was reclaimed cannot overwrite the new owner.
   * On failure `retryAfterMs` is the time left on a live lease (null when the row is terminal,
   * deleted or missing), so the queue can redeliver the job once the lease would have expired.
   */
  async claim(reportId: string, now: Date): Promise<ClaimResult> {
    const leaseCutoff = new Date(now.getTime() - REPORT_PROCESSING_LEASE_MS);
    const { count } = await this.prisma.report.updateMany({
      where: {
        id: reportId,
        deletedAt: null,
        OR: [
          { status: 'QUEUED' },
          { status: 'PROCESSING', startedAt: { lt: leaseCutoff } },
        ],
      },
      data: {
        status: 'PROCESSING',
        startedAt: now,
        attempts: { increment: 1 },
      },
    });
    if (count === 1) return { claimed: true, token: now };

    const row = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { status: true, startedAt: true, deletedAt: true },
    });
    if (row && !row.deletedAt && row.status === 'PROCESSING' && row.startedAt) {
      const left =
        row.startedAt.getTime() + REPORT_PROCESSING_LEASE_MS - now.getTime();
      return { claimed: false, retryAfterMs: Math.max(left, 0) };
    }
    return { claimed: false, retryAfterMs: null };
  }

  /** Fenced: only the current owner (status PROCESSING and the same claim token) may complete. */
  async markCompleted(
    reportId: string,
    token: Date,
    completedAt: Date,
    expiresAt: Date,
    artifact: ArtifactInfo | null,
  ): Promise<boolean> {
    const { count } = await this.prisma.report.updateMany({
      where: {
        id: reportId,
        status: 'PROCESSING',
        startedAt: token,
        deletedAt: null,
      },
      data: {
        status: 'COMPLETED',
        completedAt,
        expiresAt,
        errorCategory: null,
        errorMessage: null,
        artifactKey: artifact?.key ?? null,
        artifactBytes: artifact?.bytes ?? null,
        artifactContentType: artifact?.contentType ?? null,
      },
    });
    return count === 1;
  }

  /** Transient failure with attempts left: PROCESSING -> QUEUED so the BullMQ retry can claim it. */
  async markRetryable(
    reportId: string,
    token: Date,
    category: ReportErrorCategory,
  ): Promise<boolean> {
    const { count } = await this.prisma.report.updateMany({
      where: { id: reportId, status: 'PROCESSING', startedAt: token },
      data: {
        status: 'QUEUED',
        errorCategory: category,
        errorMessage: SAFE_ERROR_MESSAGE[category],
      },
    });
    return count === 1;
  }

  /** Permanent failure or last attempt: PROCESSING -> FAILED. Never touches COMPLETED. */
  async markFailed(
    reportId: string,
    token: Date,
    category: ReportErrorCategory,
    now: Date,
  ): Promise<boolean> {
    const { count } = await this.prisma.report.updateMany({
      where: { id: reportId, status: 'PROCESSING', startedAt: token },
      data: {
        status: 'FAILED',
        completedAt: now,
        errorCategory: category,
        errorMessage: SAFE_ERROR_MESSAGE[category],
      },
    });
    return count === 1;
  }

  /**
   * Manual retry: FAILED -> QUEUED for this farm's report, `manualRetries + 1`. Clears error fields;
   * an existing snapshot is kept (the next run reuses it). When `maxManualRetries` is given the cap is
   * enforced in the same conditional update. The caller enqueues afterwards.
   */
  async resetForRetry(
    reportId: string,
    farmId: string,
    maxManualRetries?: number,
  ): Promise<boolean> {
    const { count } = await this.prisma.report.updateMany({
      where: {
        id: reportId,
        farmId,
        status: 'FAILED',
        deletedAt: null,
        ...(maxManualRetries !== undefined
          ? { manualRetries: { lt: maxManualRetries } }
          : {}),
      },
      data: {
        status: 'QUEUED',
        manualRetries: { increment: 1 },
        errorCategory: null,
        errorMessage: null,
        startedAt: null,
        completedAt: null,
      },
    });
    if (count === 1) this.log.info('Report reset for retry', { reportId });
    return count === 1;
  }

  /** Retention from the farm's current subscription plan; 365 days when there is none. */
  async retentionDays(farmId: string): Promise<number> {
    const sub = await this.prisma.farmSubscription.findFirst({
      where: { farmId },
      orderBy: { createdAt: 'desc' },
      select: { subscriptionPlan: { select: { reportRetentionDays: true } } },
    });
    const days = sub?.subscriptionPlan.reportRetentionDays;
    return typeof days === 'number' && days > 0
      ? days
      : DEFAULT_REPORT_RETENTION_DAYS;
  }
}
