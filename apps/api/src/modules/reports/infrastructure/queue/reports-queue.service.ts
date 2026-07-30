import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { REPORTS_JOB, REPORTS_QUEUE } from './reports.queue.constants';

/**
 * Thin BullMQ enqueue wrapper (RD-013a) — kept separate from `ReportsService`
 * so the service and the processor can both depend on it without a circular
 * import between `reports.service.ts` and `reports.processor.ts`.
 */
@Injectable()
export class ReportsQueueService {
  constructor(@InjectQueue(REPORTS_QUEUE) private readonly queue: Queue) {}

  async enqueue(jobId: string): Promise<void> {
    await this.queue.add(
      REPORTS_JOB,
      { jobId },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        jobId,
        removeOnComplete: 500,
        removeOnFail: 500,
      },
    );
  }
}
