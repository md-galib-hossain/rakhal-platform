import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { Queue } from 'bullmq';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import {
  OUTBOX_DRAIN_INTERVAL_MS,
  OUTBOX_DRAIN_JOB,
  OUTBOX_QUEUE,
} from './outbox.queue.constants';

/**
 * Thin BullMQ scheduling wrapper (mirrors `ReportsQueueService`'s split from
 * its processor). Registers one repeatable "drain the outbox" trigger job on
 * boot — the job itself carries no payload; `OutboxProcessor` re-queries
 * PENDING rows fresh on every tick, so there is nothing to lose if this job
 * is skipped or overlaps.
 */
@Injectable()
export class OutboxQueueService implements OnModuleInit {
  private readonly log: LoggerService;

  constructor(
    @InjectQueue(OUTBOX_QUEUE) private readonly queue: Queue,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(OutboxQueueService.name);
  }

  async onModuleInit(): Promise<void> {
    // BullMQ keys a repeatable job by its interval, so a changed interval would
    // leave the old (e.g. 5s) schedule running in Redis beside the new one.
    const existing = await this.queue.getRepeatableJobs();
    for (const job of existing) {
      if (
        job.name === OUTBOX_DRAIN_JOB &&
        job.every !== String(OUTBOX_DRAIN_INTERVAL_MS)
      ) {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }
    await this.queue.add(
      OUTBOX_DRAIN_JOB,
      {},
      {
        jobId: OUTBOX_DRAIN_JOB, // fixed id — re-adding on every boot just updates the existing repeatable job, never duplicates it
        repeat: { every: OUTBOX_DRAIN_INTERVAL_MS },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    );
    this.log.info('Outbox drain job scheduled', {
      intervalMs: OUTBOX_DRAIN_INTERVAL_MS,
    });
  }

  /** Nudge an immediate drain pass (e.g. from a test) without waiting for the next tick. */
  async triggerNow(): Promise<void> {
    await this.queue.add(
      OUTBOX_DRAIN_JOB,
      {},
      { removeOnComplete: 100, removeOnFail: 100 },
    );
  }
}
