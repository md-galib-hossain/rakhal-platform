import { Inject, Injectable } from '@nestjs/common';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  REPORT_JOB_ATTEMPTS,
  REPORT_PROCESSING_LEASE_MS,
  REPORT_QUEUED_STALE_MS,
  REPORT_RECONCILE_BATCH,
  SAFE_ERROR_MESSAGE,
} from './report-pipeline.constants';

export const REPORT_JOB_ENSURER = Symbol('REPORT_JOB_ENSURER');

/** Queue-side helper used only by reconcile: makes sure the row's current job exists. */
export interface ReportJobEnsurer {
  /** True when a new job was added, false when a live (waiting/active/delayed) job already existed. */
  ensureJob(reportId: string): Promise<boolean>;
}

/**
 * Recovers rows stranded by a crashed worker or a lost queue job. Every transition is a conditional
 * `updateMany` on the exact observed state, so it is safe next to live workers and to itself running
 * twice. Scheduling is RPT-10's job; nothing calls this yet.
 */
@Injectable()
export class ReportReconcileService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    @Inject(REPORT_JOB_ENSURER) private readonly jobs: ReportJobEnsurer,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReportReconcileService.name);
  }

  async reconcile(now: Date): Promise<{ requeued: number; failed: number }> {
    let requeued = 0;
    let failed = 0;

    const stale = await this.prisma.report.findMany({
      where: {
        status: 'PROCESSING',
        deletedAt: null,
        startedAt: {
          lt: new Date(now.getTime() - REPORT_PROCESSING_LEASE_MS),
        },
      },
      select: { id: true, attempts: true, startedAt: true },
      orderBy: { startedAt: 'asc' },
      take: REPORT_RECONCILE_BATCH,
    });
    for (const row of stale) {
      const same = {
        id: row.id,
        status: 'PROCESSING' as const,
        startedAt: row.startedAt,
        deletedAt: null,
      };
      try {
        if (row.attempts >= REPORT_JOB_ATTEMPTS) {
          const { count } = await this.prisma.report.updateMany({
            where: same,
            data: {
              status: 'FAILED',
              completedAt: now,
              errorCategory: 'GENERATION_FAILED',
              errorMessage: SAFE_ERROR_MESSAGE.GENERATION_FAILED,
            },
          });
          failed += count;
        } else {
          const { count } = await this.prisma.report.updateMany({
            where: same,
            data: { status: 'QUEUED' },
          });
          if (count === 1) {
            await this.jobs.ensureJob(row.id);
            requeued += 1;
          }
        }
      } catch {
        this.log.warn('Report reconcile step failed', { reportId: row.id });
      }
    }

    const queued = await this.prisma.report.findMany({
      where: {
        status: 'QUEUED',
        deletedAt: null,
        updatedAt: { lt: new Date(now.getTime() - REPORT_QUEUED_STALE_MS) },
      },
      select: { id: true },
      orderBy: { updatedAt: 'asc' },
      take: REPORT_RECONCILE_BATCH,
    });
    for (const row of queued) {
      try {
        if (await this.jobs.ensureJob(row.id)) requeued += 1;
      } catch {
        this.log.warn('Report reconcile enqueue failed', { reportId: row.id });
      }
    }

    this.log.info('Reports reconciled', { requeued, failed });
    return { requeued, failed };
  }
}
