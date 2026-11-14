import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  NOTIFICATION_FIRE_JOB,
  NOTIFICATION_OCCURRENCE_QUEUE,
  ScheduleQueuePort,
} from './schedule-queue.port';

const PAGE = 1000;

/**
 * BullMQ adapter (RAKHAL-493, §3.3): `jobId = occurrence id`, payload carries the id only, 5 attempts with 30 s
 * exponential backoff. Completed and failed jobs are removed — Postgres is the record, and a retained failed job would
 * block re-adding the same id.
 */
@Injectable()
export class BullmqScheduleQueue implements ScheduleQueuePort {
  constructor(
    @InjectQueue(NOTIFICATION_OCCURRENCE_QUEUE) private readonly queue: Queue,
  ) {}

  async add(occurrenceId: string, delayMs: number): Promise<void> {
    await this.queue.add(
      NOTIFICATION_FIRE_JOB,
      { occurrenceId },
      {
        jobId: occurrenceId,
        delay: Math.max(0, Math.floor(delayMs)),
        attempts: 5,
        backoff: { type: 'exponential', delay: 30_000 },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async remove(occurrenceId: string): Promise<void> {
    const job = await this.queue.getJob(occurrenceId);
    if (!job) return;
    try {
      await job.remove();
    } catch {
      // Active (locked) jobs cannot be removed; the processor re-checks status when it runs.
    }
  }

  async liveJobIds(): Promise<string[]> {
    const ids: string[] = [];
    for (let start = 0; ; start += PAGE) {
      const jobs = await this.queue.getJobs(
        ['delayed', 'waiting', 'active'],
        start,
        start + PAGE - 1,
      );
      for (const j of jobs) if (j?.id) ids.push(String(j.id));
      if (jobs.length < PAGE) break;
    }
    return [...new Set(ids)];
  }
}
