import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { ReportsService } from '../../application/services/reports.service';
import { REPORTS_QUEUE } from './reports.queue.constants';

interface ReportJobPayload {
  jobId: string;
}

/**
 * BullMQ worker for report generation (RD-013a). `ReportsService.generate()`
 * only creates the `ReportJob` row and enqueues it; this processor does the
 * actual (potentially slow) aggregation + render off the request thread.
 */
@Processor(REPORTS_QUEUE)
export class ReportsProcessor extends WorkerHost {
  private readonly log: LoggerService;

  constructor(
    private readonly reportsService: ReportsService,
    logger: LoggerService,
  ) {
    super();
    this.log = logger.setContext(ReportsProcessor.name);
  }

  async process(job: Job<ReportJobPayload>): Promise<void> {
    const { jobId } = job.data;
    this.log.info('Report job picked by worker', {
      reportJobId: jobId,
      queueJobId: job.id,
    });
    try {
      await this.reportsService.executeJob(jobId);
    } catch (error) {
      this.log.error('Report generation failed', error, { reportJobId: jobId });
      throw error;
    }
  }
}
