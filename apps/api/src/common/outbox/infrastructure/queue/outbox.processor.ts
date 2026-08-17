import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { OutboxDrainService } from '../../application/outbox-drain.service';
import { OUTBOX_QUEUE } from './outbox.queue.constants';

/** BullMQ worker for the outbox drain trigger. Delegates all real work to `OutboxDrainService` so the logic stays unit-testable without Redis. */
@Processor(OUTBOX_QUEUE)
export class OutboxProcessor extends WorkerHost {
  private readonly log: LoggerService;

  constructor(
    private readonly drainService: OutboxDrainService,
    logger: LoggerService,
  ) {
    super();
    this.log = logger.setContext(OutboxProcessor.name);
  }

  async process(job: Job): Promise<void> {
    const result = await this.drainService.drainBatch();
    if (result.claimed > 0) {
      this.log.info('Outbox drain pass complete', {
        queueJobId: job.id,
        ...result,
      });
    }
  }
}
