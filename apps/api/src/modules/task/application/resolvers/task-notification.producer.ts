import { Injectable } from '@nestjs/common';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { localDateIso } from 'src/common/farm-time/farm-time';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { txStore } from 'src/core/database/prisma/tx-context';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationScheduler } from 'src/modules/notification/application/services/notification-scheduler.service';
import { DEFAULT_SOURCE_ROLES } from 'src/modules/notification/domain/audience';
import { allDayAnchorFromYmd } from 'src/modules/notification/domain/schedule-math';
import { plainTaskKey, ruleTaskKey } from './task-source.resolver';

const OPEN = ['PENDING', 'IN_PROGRESS', 'BLOCKED'];
/** Lead of one day, in minutes. */
const ONE_DAY = 1440;
/** Inside a caller's transaction the commit time is unknown; try the queue shortly after (idempotent by jobId). */
const IN_TX_ENQUEUE_DELAY_MS = 3000;

/** The Task columns the producer needs. */
export interface TaskNotifyRow {
  id: string;
  status: string;
  priority: string;
  safetyCritical: boolean;
  ruleKey: string | null;
  dueAt: Date;
  assignedToId: string | null;
}

/**
 * Task -> NotificationScheduler producer (RAKHAL-496, docs/EPIC_NOTIFICATIONS_V2.md §3.4). Never throws into the Task write
 * that called it.
 *
 * - plain task: group `id:<taskId>`, allDay, leads `[1 day]` (+ day-of for HIGH or safety-critical).
 * - rule task: group `rule:<ruleKey>:<farm-local due ymd>`, leads `[1 day, 0]`; N animals collapse to ONE schedule.
 */
@Injectable()
export class TaskNotificationProducer {
  private readonly log: LoggerService;

  constructor(
    private readonly scheduler: NotificationScheduler,
    private readonly prisma: PrismaService,
    private readonly farmClock: FarmClockService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(TaskNotificationProducer.name);
  }

  /** Group key of a task as it is now (use BEFORE an edit to learn the old key). */
  async keyOf(farmId: string, task: TaskNotifyRow): Promise<string | null> {
    return this.keyWith(await this.farmClock.timezone(farmId), task);
  }

  /**
   * Create / update / complete / cancel / reopen: open tasks are upserted (batched by group key, one write per group);
   * closed ones refresh their group so an emptied group cancels. `staleKeys` are keys the tasks used to belong to.
   */
  async sync(
    farmId: string,
    tasks: TaskNotifyRow[],
    staleKeys: (string | null)[] = [],
  ): Promise<void> {
    try {
      const timezone = await this.farmClock.timezone(farmId);
      const groups = new Map<string, TaskNotifyRow[]>();
      const refresh = new Set(staleKeys.filter((k): k is string => k !== null));
      for (const t of tasks) {
        const key = this.keyWith(timezone, t);
        if (OPEN.includes(t.status)) {
          groups.set(key, [...(groups.get(key) ?? []), t]);
        } else {
          refresh.add(key);
        }
      }
      const toEnqueue: string[] = [];
      for (const [sourceKey, members] of groups) {
        const result = await this.scheduler.upsertForSource(
          this.inputFor(farmId, timezone, sourceKey, members),
        );
        if (result) toEnqueue.push(...result.toEnqueue);
      }
      for (const key of groups.keys()) refresh.delete(key);
      if (refresh.size > 0) {
        await this.scheduler.refreshSource(farmId, 'TASK', [...refresh]);
      }
      this.enqueue(toEnqueue);
    } catch (err) {
      this.warn('sync', err);
    }
  }

  /** Delete: the row is gone, so the caller passes the key it computed beforehand. */
  async cancelKeys(farmId: string, keys: (string | null)[]): Promise<void> {
    const real = keys.filter((k): k is string => k !== null);
    if (real.length === 0) return;
    try {
      await this.scheduler.refreshSource(farmId, 'TASK', real);
    } catch (err) {
      this.warn('cancelKeys', err);
    }
  }

  /** Bulk creation path (follow-up engine): load the new tasks once and group them in memory. */
  async syncByIds(farmId: string, taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    const rows = await this.prisma.task.findMany({
      where: { id: { in: taskIds }, farmId },
      select: {
        id: true,
        status: true,
        priority: true,
        safetyCritical: true,
        ruleKey: true,
        dueAt: true,
        assignedToId: true,
      },
    });
    await this.sync(farmId, rows);
  }

  private keyWith(timezone: string, t: TaskNotifyRow): string {
    return t.ruleKey
      ? ruleTaskKey(t.ruleKey, localDateIso(timezone, t.dueAt))
      : plainTaskKey(t.id);
  }

  private inputFor(
    farmId: string,
    timezone: string,
    sourceKey: string,
    members: TaskNotifyRow[],
  ) {
    const first = members[0];
    const isRule = Boolean(first.ruleKey);
    const urgent = members.some(
      (m) => m.priority === 'HIGH' || m.safetyCritical,
    );
    const assignees = [
      ...new Set(
        members.flatMap((m) => (m.assignedToId ? [m.assignedToId] : [])),
      ),
    ];
    return {
      farmId,
      sourceType: 'TASK' as const,
      sourceKey,
      anchorAt: allDayAnchorFromYmd(localDateIso(timezone, first.dueAt)),
      allDay: true,
      leadMinutes: isRule || urgent ? [ONE_DAY, 0] : [ONE_DAY],
      eventKey: 'scheduled_upcoming',
      category: 'operational',
      priority: urgent ? 'high' : 'medium',
      audienceHint: {
        userIds: assignees,
        roles:
          isRule || assignees.length === 0 ? [...DEFAULT_SOURCE_ROLES] : [],
      },
    };
  }

  /** After the commit: right away outside a transaction, shortly after inside one (reconcile is the backstop). */
  private enqueue(ids: string[]): void {
    if (ids.length === 0) return;
    const run = () =>
      this.scheduler
        .enqueueAfterCommit(ids)
        .catch((err: unknown) => this.warn('enqueue', err));
    if (txStore.getStore()) {
      // `exit`: the timer inherits the caller's transaction store, which is finished by then.
      setTimeout(
        () => txStore.exit(() => void run()),
        IN_TX_ENQUEUE_DELAY_MS,
      ).unref();
    } else {
      void run();
    }
  }

  private warn(where: string, err: unknown): void {
    this.log.warn('Task notification hook failed', {
      where,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
