import { ScheduleQueuePort } from './schedule-queue.port';

/**
 * In-memory `ScheduleQueuePort` for specs and e2e (RAKHAL-493). Nothing waits: tests move a fake clock and call
 * `runDue(now, handler)` to run whatever is due, in run-time order. `clock` supplies "now" when a job is added.
 */
export class InMemoryScheduleQueue implements ScheduleQueuePort {
  private readonly jobs = new Map<string, { runAt: number }>();

  constructor(private readonly clock: () => Date = () => new Date()) {}

  add(occurrenceId: string, delayMs: number): Promise<void> {
    // BullMQ ignores an id that is already queued.
    if (!this.jobs.has(occurrenceId)) {
      this.jobs.set(occurrenceId, {
        runAt: this.clock().getTime() + delayMs,
      });
    }
    return Promise.resolve();
  }

  remove(occurrenceId: string): Promise<void> {
    this.jobs.delete(occurrenceId);
    return Promise.resolve();
  }

  liveJobIds(): Promise<string[]> {
    return Promise.resolve([...this.jobs.keys()]);
  }

  has(occurrenceId: string): boolean {
    return this.jobs.has(occurrenceId);
  }

  get size(): number {
    return this.jobs.size;
  }

  /** Test hook: drop all jobs, as a Redis flush would. */
  flush(): void {
    this.jobs.clear();
  }

  /** Ids whose run time has arrived at `now`, earliest first. */
  dueIds(now: Date): string[] {
    return [...this.jobs.entries()]
      .filter(([, j]) => j.runAt <= now.getTime())
      .sort((a, b) => a[1].runAt - b[1].runAt)
      .map(([id]) => id);
  }

  /** Runs and removes every due job. Returns the ids processed. */
  async runDue(
    now: Date,
    handler: (occurrenceId: string) => Promise<void>,
  ): Promise<string[]> {
    const ids = this.dueIds(now);
    for (const id of ids) {
      this.jobs.delete(id);
      await handler(id);
    }
    return ids;
  }
}
