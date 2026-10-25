import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { OBJECT_STORAGE } from 'src/modules/media/application/ports/object-storage.port';
import type { ObjectStoragePort } from 'src/modules/media/application/ports/object-storage.port';
import type { ReportErrorCategory } from '../../domain/contracts/enums';
import type { MetricId } from '../../domain/contracts/metric-definition';
import type { ReportPeriod } from '../../domain/contracts/period';
import type { ReportScope } from '../../domain/contracts/scope';
import {
  assertNoFinance,
  type ReportSnapshotPayload,
} from '../../domain/contracts/snapshot';
import type { ReportTemplateDefinition } from '../../domain/contracts/template';
import { detectPeriodKind, resolvePreset } from '../../domain/period';
import { ReportError } from '../../domain/report-error';
import {
  REPORT_COMPUTE,
  REPORT_RENDERER,
  type ReportComputeService,
  type ReportRenderer,
} from '../ports/report-ports';
import { toReportError } from './report-error-mapper';
import { ReportLifecycleService } from './report-lifecycle.service';
import {
  REPORT_LEASE_RECHECK_BUFFER_MS,
  SAFE_ERROR_MESSAGE,
} from './report-pipeline.constants';

export type ProcessOutcome =
  | { status: 'skipped' }
  | { status: 'completed' }
  /** Another worker holds a live lease: redeliver the job after `delayMs` (not a completion). */
  | { status: 'delayed'; delayMs: number }
  /** Transient failure, row is back to QUEUED, the queue should retry. */
  | { status: 'retry'; category: ReportErrorCategory }
  /** Row is FAILED; do not retry. */
  | { status: 'failed'; category: ReportErrorCategory };

export interface AttemptInfo {
  /** Attempts already finished before this one (BullMQ `job.attemptsMade`). */
  attemptsMade: number;
  /** Total attempts allowed (BullMQ `job.opts.attempts`). */
  maxAttempts: number;
}

/**
 * Rebuilds the `ReportPeriod` from the stored row. The label is not persisted, so calendar-shaped
 * periods are re-resolved through `resolvePreset` (same label as at request time); anything else gets
 * the custom label.
 */
export function periodFromRow(row: {
  periodStart: Date;
  periodEnd: Date;
  periodStartDate: string;
  periodEndDate: string;
  timezone: string;
}): ReportPeriod {
  const raw: ReportPeriod = {
    start: row.periodStart.toISOString(),
    end: row.periodEnd.toISOString(),
    startDate: row.periodStartDate,
    endDate: row.periodEndDate,
    timezone: row.timezone,
    label:
      row.periodStartDate === row.periodEndDate
        ? row.periodStartDate
        : `${row.periodStartDate} - ${row.periodEndDate}`,
  };
  try {
    const kind = detectPeriodKind(raw);
    const preset =
      kind === 'week'
        ? 'this_week'
        : kind === 'month'
          ? 'this_month'
          : kind === 'year'
            ? 'this_year'
            : null;
    if (!preset) return raw;
    const p = resolvePreset(preset, row.periodStart, row.timezone);
    return p.startDate === raw.startDate && p.endDate === raw.endDate
      ? { ...raw, label: p.label }
      : raw;
  } catch {
    return raw;
  }
}

function templateFrom(
  definition: unknown,
  version: number,
): ReportTemplateDefinition {
  const d = definition as Partial<ReportTemplateDefinition> | null;
  if (!d || !Array.isArray(d.sections) || !d.thresholds) {
    throw new ReportError('INVALID_CONFIG', SAFE_ERROR_MESSAGE.INVALID_CONFIG);
  }
  return { ...(d as ReportTemplateDefinition), version };
}

/**
 * The generation flow behind one queue job (RPT-09). State changes go through
 * {@link ReportLifecycleService}; this class never writes `status` itself.
 *
 * Idempotency: claim is compare-and-set, the snapshot is created once (unique `reportId`) and reused
 * by every later attempt, and a terminal row is never claimed again.
 */
@Injectable()
export class ReportGenerationService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly lifecycle: ReportLifecycleService,
    @Inject(REPORT_COMPUTE) private readonly compute: ReportComputeService,
    @Inject(REPORT_RENDERER) private readonly renderer: ReportRenderer,
    @Inject(OBJECT_STORAGE) private readonly storage: ObjectStoragePort,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReportGenerationService.name);
  }

  async process(
    reportId: string,
    attempt: AttemptInfo,
  ): Promise<ProcessOutcome> {
    const startedAt = new Date();
    const claim = await this.lifecycle.claim(reportId, startedAt);
    if (!claim.claimed) {
      if (claim.retryAfterMs !== null) {
        // A live lease: do NOT complete the job, or a crashed owner's row would be stranded.
        this.log.info('Report job delayed (lease held)', { reportId });
        return {
          status: 'delayed',
          delayMs: claim.retryAfterMs + REPORT_LEASE_RECHECK_BUFFER_MS,
        };
      }
      this.log.info('Report job skipped (not claimable)', { reportId });
      return { status: 'skipped' };
    }

    try {
      return (await this.run(reportId, startedAt))
        ? { status: 'completed' }
        : { status: 'skipped' };
    } catch (raw) {
      return this.handleFailure(reportId, startedAt, raw, attempt);
    }
  }

  private async isDeleted(reportId: string): Promise<boolean> {
    const r = await this.prisma.report.findUnique({
      where: { id: reportId },
      select: { deletedAt: true },
    });
    return !r || r.deletedAt !== null;
  }

  /** Returns true when the report completed, false when skipped (deleted or fenced out). */
  private async run(reportId: string, startedAt: Date): Promise<boolean> {
    const report = await this.prisma.report.findUnique({
      where: { id: reportId },
      include: { templateVersion: true },
    });
    if (!report) {
      throw new ReportError(
        'INVALID_CONFIG',
        SAFE_ERROR_MESSAGE.INVALID_CONFIG,
      );
    }

    if (report.deletedAt) {
      this.log.info('Report deleted before generation; skipped', { reportId });
      return false;
    }

    // The snapshot is captured once. A retry after a render/storage failure reuses it.
    let payload: ReportSnapshotPayload;
    const existing = await this.prisma.reportSnapshot.findUnique({
      where: { reportId },
    });
    if (existing) {
      payload = existing.payload as unknown as ReportSnapshotPayload;
    } else {
      const template = templateFrom(
        report.templateVersion.definition,
        report.templateVersion.version,
      );
      let computed: ReportSnapshotPayload;
      try {
        computed = await this.compute.compute({
          farmId: report.farmId,
          includeFinance: report.includesFinance,
          type: report.type,
          period: periodFromRow(report),
          scope: report.scope as unknown as ReportScope,
          selectedMetricIds: this.metricIds(report.selectedMetricIds),
          template,
          generatedAt: startedAt,
        });
      } catch (e) {
        throw toReportError(e, 'compute');
      }
      payload = await this.persistSnapshot(reportId, computed);
    }

    if (!report.includesFinance) {
      try {
        assertNoFinance(payload);
      } catch {
        throw new ReportError(
          'PERMISSION_DENIED',
          SAFE_ERROR_MESSAGE.PERMISSION_DENIED,
        );
      }
    }

    if (await this.isDeleted(reportId)) {
      this.log.info('Report deleted mid-run; skipped', { reportId });
      return false;
    }

    let rendered: Awaited<ReturnType<ReportRenderer['render']>>;
    try {
      rendered = await this.renderer.render(payload);
    } catch (e) {
      throw toReportError(e, 'render');
    }

    let artifact: { key: string; bytes: number; contentType: string } | null =
      null;
    if (rendered) {
      // Key is never logged.
      const key = `reports/${report.farmId}/${report.id}.pdf`;
      try {
        await this.storage.put({
          key,
          body: rendered.body,
          contentType: rendered.contentType,
        });
      } catch (e) {
        throw toReportError(e, 'storage');
      }
      artifact = {
        key,
        bytes: rendered.body.length,
        contentType: rendered.contentType,
      };
    }

    const completedAt = new Date();
    const days = await this.lifecycle.retentionDays(report.farmId);
    const expiresAt = new Date(completedAt.getTime() + days * 86_400_000);
    const changed = await this.lifecycle.markCompleted(
      reportId,
      startedAt,
      completedAt,
      expiresAt,
      artifact,
    );
    if (!changed) {
      // Soft-deleted while rendering (the artifact key is shared, so only delete it in that case:
      // a fenced-out worker must not remove the new owner's file).
      if (artifact && (await this.isDeleted(reportId))) {
        await this.discardArtifact(reportId, artifact.key);
      }
      this.log.info('Report not completed (deleted or superseded)', {
        reportId,
      });
      return false;
    }
    this.log.info('Report generated', {
      reportId,
      farmId: report.farmId,
      hasArtifact: artifact !== null,
    });
    return true;
  }

  private async discardArtifact(reportId: string, key: string): Promise<void> {
    try {
      await this.storage.delete(key);
    } catch {
      this.log.warn('Orphan report artifact could not be deleted', {
        reportId,
      });
    }
  }

  /** Creates the immutable snapshot; on a unique-key race returns the row the other worker wrote. */
  private async persistSnapshot(
    reportId: string,
    payload: ReportSnapshotPayload,
  ): Promise<ReportSnapshotPayload> {
    try {
      await this.prisma.reportSnapshot.create({
        data: {
          reportId,
          payload: payload as unknown as Prisma.InputJsonValue,
          schemaVersion: payload.schemaVersion,
          calcVersion: payload.calcVersion,
          templateVersion: payload.templateVersion,
          includesFinance: payload.includesFinance,
        },
      });
      return payload;
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        const winner = await this.prisma.reportSnapshot.findUnique({
          where: { reportId },
        });
        if (winner) return winner.payload as unknown as ReportSnapshotPayload;
      }
      throw toReportError(e, 'persist');
    }
  }

  private metricIds(raw: unknown): MetricId[] {
    if (!Array.isArray(raw) || raw.some((x) => typeof x !== 'string')) {
      throw new ReportError(
        'INVALID_CONFIG',
        SAFE_ERROR_MESSAGE.INVALID_CONFIG,
      );
    }
    return raw as MetricId[];
  }

  private async handleFailure(
    reportId: string,
    token: Date,
    raw: unknown,
    attempt: AttemptInfo,
  ): Promise<ProcessOutcome> {
    const err = toReportError(raw, 'persist');
    const isFinal = attempt.attemptsMade + 1 >= attempt.maxAttempts;
    // Category only: never the error text, stack or payload.
    this.log.warn('Report generation failed', {
      reportId,
      category: err.category,
      transient: err.transient,
      final: isFinal,
    });
    const retryOutcome: ProcessOutcome = {
      status: 'retry',
      category: err.category,
    };
    try {
      if (err.transient && !isFinal) {
        await this.lifecycle.markRetryable(reportId, token, err.category);
        return retryOutcome;
      }
      await this.lifecycle.markFailed(
        reportId,
        token,
        err.category,
        new Date(),
      );
      return { status: 'failed', category: err.category };
    } catch {
      // The state write itself failed: the row stays PROCESSING under its lease. Let the queue
      // redeliver (the lease guard delays it); reconcile fails the row once attempts are exhausted.
      this.log.warn('Report state write failed; leaving to retry/reconcile', {
        reportId,
      });
      return retryOutcome;
    }
  }
}
