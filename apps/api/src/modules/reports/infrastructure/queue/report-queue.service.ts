import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ReportError } from '../../domain/report-error';
import type { ReportQueue } from '../../application/ports/report-ports';
import type { ReportJobEnsurer } from '../../application/pipeline/report-reconcile.service';
import {
  REPORT_GENERATE_JOB,
  REPORT_JOB_ATTEMPTS,
  REPORT_JOB_BACKOFF_MS,
  REPORTS_QUEUE,
  SAFE_ERROR_MESSAGE,
} from '../../application/pipeline/report-pipeline.constants';

export interface ReportJobData {
  reportId: string;
}

@Injectable()
export class ReportQueueService implements ReportQueue, ReportJobEnsurer {
  private readonly log: LoggerService;

  constructor(
    @InjectQueue(REPORTS_QUEUE) private readonly queue: Queue<ReportJobData>,
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReportQueueService.name);
  }

  /**
   * The job id follows the row: `reportId` for the original run, `reportId-r<n>` after the n-th manual
   * retry, so a retry can never collide with (and be dropped by) an older job record.
   */
  static jobIdFor(reportId: string, manualRetries: number): string {
    return manualRetries > 0 ? `${reportId}-r${manualRetries}` : reportId;
  }

  async enqueue(reportId: string): Promise<void> {
    await this.ensureJob(reportId);
  }

  /**
   * Idempotent: a waiting/active/delayed job for the row's current id is left alone; a finished
   * (completed/failed) record under that same id is removed so a fresh job can take its place.
   * Returns true when a new job was added.
   */
  async ensureJob(reportId: string): Promise<boolean> {
    try {
      const row = await this.prisma.report.findUnique({
        where: { id: reportId },
        select: { manualRetries: true },
      });
      const jobId = ReportQueueService.jobIdFor(
        reportId,
        row?.manualRetries ?? 0,
      );
      const existing = await this.queue.getJob(jobId);
      if (existing) {
        const state = await existing.getState();
        if (state !== 'failed' && state !== 'completed') return false;
        await existing.remove();
      }
      await this.queue.add(
        REPORT_GENERATE_JOB,
        { reportId },
        {
          jobId,
          attempts: REPORT_JOB_ATTEMPTS,
          backoff: { type: 'exponential', delay: REPORT_JOB_BACKOFF_MS },
          removeOnComplete: { age: 24 * 3600, count: 1000 },
          removeOnFail: { age: 7 * 24 * 3600, count: 1000 },
        },
      );
      this.log.info('Report enqueued', { reportId });
      return true;
    } catch (e) {
      this.log.error('Report enqueue failed', e, { reportId });
      throw new ReportError(
        'QUEUE_UNAVAILABLE',
        SAFE_ERROR_MESSAGE.QUEUE_UNAVAILABLE,
      );
    }
  }
}
