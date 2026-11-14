import { Processor, WorkerHost } from '@nestjs/bullmq';
import { DelayedError, Job, UnrecoverableError } from 'bullmq';
import { ReportGenerationService } from '../../application/pipeline/report-generation.service';
import {
  REPORT_JOB_ATTEMPTS,
  REPORT_WORKER_CONCURRENCY,
  REPORTS_QUEUE,
} from '../../application/pipeline/report-pipeline.constants';
import type { ReportJobData } from './report-queue.service';

@Processor(REPORTS_QUEUE, { concurrency: REPORT_WORKER_CONCURRENCY })
export class ReportsProcessor extends WorkerHost {
  constructor(private readonly generation: ReportGenerationService) {
    super();
  }

  async process(job: Job<ReportJobData>, token?: string): Promise<void> {
    const outcome = await this.generation.process(job.data.reportId, {
      attemptsMade: job.attemptsMade,
      maxAttempts: job.opts.attempts ?? REPORT_JOB_ATTEMPTS,
    });
    switch (outcome.status) {
      case 'delayed':
        // Live lease held elsewhere: park the job until it would expire so a crashed owner's row is
        // picked up afterwards (completing here would strand it).
        await job.moveToDelayed(Date.now() + outcome.delayMs, token);
        throw new DelayedError();
      case 'retry':
        // Row is QUEUED again; throwing lets BullMQ back off and re-deliver.
        throw new Error(`report_transient:${outcome.category}`);
      case 'failed':
        // Row is FAILED; stop BullMQ from retrying.
        throw new UnrecoverableError(`report_failed:${outcome.category}`);
      default:
        return;
    }
  }
}
