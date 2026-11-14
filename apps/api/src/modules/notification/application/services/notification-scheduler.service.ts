import { randomUUID } from 'crypto';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnApplicationBootstrap,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  NotificationOccurrence,
  NotificationSchedule,
  Prisma,
} from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { MetricsService } from 'src/core/observability/metrics/metrics.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { DEFAULT_SOURCE_ROLES } from '../../domain/audience';
import {
  advanceSeries,
  anchorFromEntity,
  applyJitter,
  firstLiveAnchor,
  normalizeLeads,
  PlannedOccurrence,
  ScheduleRepeatType,
  validateLeads,
} from '../../domain/schedule-math';
import { NOTIFICATION_CLOCK } from '../queue/notification-clock';
import type { NotificationClock } from '../queue/notification-clock';
import {
  ENQUEUE_HORIZON_MS,
  SCHEDULE_QUEUE_PORT,
} from '../queue/schedule-queue.port';
import type { ScheduleQueuePort } from '../queue/schedule-queue.port';
import { ResolverSourceType } from '../resolvers/source-resolver.port';
import { SourceResolverRegistry } from '../resolvers/source-resolver.registry';

const PAGE = 500;
const OCCURRENCE_RETENTION_MS = 60 * 24 * 60 * 60 * 1000;
const SCHEDULE_RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const PURGE_BATCH = 1000;
const MANUAL_DEFAULT_CATEGORY = 'operational';
const MANUAL_DEFAULT_PRIORITY = 'medium';

export interface UpsertForSourceInput {
  farmId: string;
  sourceType: ResolverSourceType;
  /** e.g. `id:<taskId>`, `rule:<ruleKey>:<ymd>`, `round:<applicationId>:<ymd>`, `case:<caseId>:<ymd>`. */
  sourceKey: string;
  /** allDay: the farm-local date at UTC midnight (`allDayAnchorFromYmd`); timed: a real instant. */
  anchorAt: Date;
  allDay: boolean;
  /** Farm-local `HH:mm` send time for allDay notices (default 08:00). */
  sendTime?: string;
  leadMinutes: number[];
  eventKey: string;
  category: string;
  priority: string;
  /** Display hint only; the real recipients are resolved at fire time. */
  audienceHint?: { userIds?: string[]; roles?: string[] };
}

/** What a producer must hand to `enqueueAfterCommit` once its transaction commits. */
export interface ScheduleWriteResult {
  scheduleId: string;
  toEnqueue: string[];
}

export interface ManualScheduleInput {
  title: string;
  body?: string | null;
  category?: string;
  priority?: string;
  trigger: 'DATE' | 'BEFORE_EVENT' | 'AFTER_EVENT';
  /** First anchor, already computed by the caller (farm-local date/time -> UTC). */
  baseAnchorAt: Date;
  allDay: boolean;
  sendTime?: string;
  leadMinutes: number[];
  offsetDays?: number | null;
  anchorType?: 'ANIMAL_EVENT' | 'TASK' | 'HEALTH_STEP' | null;
  anchorId?: string | null;
  repeat?: ScheduleRepeatType;
  repeatInterval?: number | null;
  repeatEndDate?: Date | null;
  audienceMode: 'USER' | 'ROLES' | 'USERS';
  audienceUserIds?: string[];
  audienceRoles?: string[];
  animalIds?: string[];
}

/**
 * Notifications v2 scheduling engine (RAKHAL-493, docs/EPIC_NOTIFICATIONS_V2.md §3). Owns schedules and occurrences in
 * Postgres and mirrors the ones due within 48 h into the queue port (BullMQ delayed jobs, jobId = occurrence id).
 *
 * Producers call `upsertForSource` / `refreshSource` / `cancelForSource` inside their own transaction (the Prisma proxy
 * joins it) and `enqueueAfterCommit` after it commits — never Redis inside a transaction. Nothing here polls: the
 * only recurring caller is the 05:00 reconcile.
 */
@Injectable()
export class NotificationScheduler implements OnApplicationBootstrap {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmClock: FarmClockService,
    private readonly registry: SourceResolverRegistry,
    private readonly metrics: MetricsService,
    @Inject(SCHEDULE_QUEUE_PORT) private readonly queue: ScheduleQueuePort,
    @Inject(NOTIFICATION_CLOCK) private readonly clock: NotificationClock,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(NotificationScheduler.name);
  }

  /** Boot reconcile (§3.6). Never blocks or crashes boot. */
  onApplicationBootstrap(): void {
    void this.reconcile().catch((err: unknown) =>
      this.log.error('Boot reconcile failed', {
        error: err instanceof Error ? err.message : String(err),
      }),
    );
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Producer API (SYSTEM schedules)
  // ---------------------------------------------------------------------------------------------------------------

  /** Idempotent by `(farmId, sourceType, sourceKey)`; moves the occurrences when the anchor or leads changed. */
  async upsertForSource(
    input: UpsertForSourceInput,
  ): Promise<ScheduleWriteResult | null> {
    const leads = normalizeLeads(input.leadMinutes);
    const leadError = validateLeads(leads, input.allDay);
    if (leadError) throw new BadRequestException(leadError);

    const now = this.clock.now();
    const timezone = await this.farmClock.timezone(input.farmId);
    const data = {
      category: input.category,
      priority: input.priority,
      eventKey: input.eventKey,
      baseAnchorAt: input.anchorAt,
      anchorAt: input.anchorAt,
      allDay: input.allDay,
      sendTime: input.sendTime ?? '08:00',
      leadMinutes: leads,
      status: 'ACTIVE' as const,
      audienceUserIds: input.audienceHint?.userIds ?? [],
      audienceRoles: input.audienceHint?.roles ?? [...DEFAULT_SOURCE_ROLES],
    };
    const where = {
      farmId: input.farmId,
      sourceType: input.sourceType,
      sourceKey: input.sourceKey,
    };

    let schedule = await this.prisma.notificationSchedule.findFirst({ where });
    if (schedule) {
      schedule = await this.prisma.notificationSchedule.update({
        where: { id: schedule.id },
        data,
      });
    } else {
      try {
        schedule = await this.prisma.notificationSchedule.create({
          data: {
            ...where,
            ...data,
            origin: 'SYSTEM',
            trigger: 'SOURCE_DUE',
            repeat: 'NONE',
            audienceMode: 'SOURCE',
          },
        });
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
        // Lost a create race with a concurrent producer: fall back to the update path.
        const winner = await this.prisma.notificationSchedule.findFirstOrThrow({
          where,
        });
        schedule = await this.prisma.notificationSchedule.update({
          where: { id: winner.id },
          data,
        });
      }
    }
    const toEnqueue = await this.applyPlan(schedule, timezone, now, 'EDITED');
    return { scheduleId: schedule.id, toEnqueue };
  }

  /**
   * Re-reads the groups through the resolver. A group with nothing left cancels its pending occurrences; a live group
   * refreshes its audience hint. Unknown keys are ignored.
   */
  async refreshSource(
    farmId: string,
    sourceType: ResolverSourceType,
    sourceKeys: string[],
  ): Promise<void> {
    if (sourceKeys.length === 0) return;
    const resolver = this.registry.get(sourceType);
    if (!resolver) {
      this.log.warn('refreshSource: no resolver registered', { sourceType });
      return;
    }
    const now = this.clock.now();
    const timezone = await this.farmClock.timezone(farmId);
    const schedules = await this.prisma.notificationSchedule.findMany({
      where: {
        farmId,
        sourceType,
        sourceKey: { in: sourceKeys },
        status: 'ACTIVE',
      },
    });
    for (const s of schedules) {
      const res = await resolver.resolve({
        farmId,
        sourceKey: s.sourceKey ?? '',
        timezone,
        now,
        leadMinutes: s.leadMinutes[0] ?? 0,
        anchorAt: s.anchorAt,
      });
      if (res.state === 'OK') {
        await this.prisma.notificationSchedule.update({
          where: { id: s.id },
          data: { audienceUserIds: res.userIds },
        });
      } else {
        await this.cancelPending(
          s.id,
          res.state === 'GONE' ? 'SOURCE_GONE' : 'ANIMALS_GONE',
        );
        await this.prisma.notificationSchedule.update({
          where: { id: s.id },
          data: { status: 'CANCELLED' },
        });
      }
    }
  }

  async cancelForSource(
    farmId: string,
    sourceType: ResolverSourceType,
    sourceKey: string,
  ): Promise<void> {
    const s = await this.prisma.notificationSchedule.findFirst({
      where: { farmId, sourceType, sourceKey },
    });
    if (!s) return;
    await this.cancelPending(s.id, 'SOURCE_GONE');
    await this.prisma.notificationSchedule.update({
      where: { id: s.id },
      data: { status: 'CANCELLED' },
    });
  }

  /**
   * Moves (or, with `null`, cancels) every USER schedule anchored on an entity. The new anchor is the entity's new
   * date shifted by each schedule's own offset. Paused schedules only get their anchor updated.
   */
  async reanchor(
    anchorType: 'ANIMAL_EVENT' | 'TASK' | 'HEALTH_STEP',
    anchorId: string,
    newAnchorAt: Date | null,
  ): Promise<string[]> {
    const schedules = await this.prisma.notificationSchedule.findMany({
      where: {
        anchorType,
        anchorId,
        origin: 'USER',
        status: { in: ['ACTIVE', 'PAUSED'] },
      },
    });
    const now = this.clock.now();
    const toEnqueue: string[] = [];
    const tzCache = new Map<string, string>();
    for (const s of schedules) {
      if (newAnchorAt === null) {
        await this.cancelPending(s.id, 'SOURCE_GONE');
        await this.prisma.notificationSchedule.update({
          where: { id: s.id },
          data: { status: 'CANCELLED' },
        });
        continue;
      }
      if (s.trigger !== 'BEFORE_EVENT' && s.trigger !== 'AFTER_EVENT') continue;
      const timezone = await this.tzFor(s.farmId, tzCache);
      const anchor = anchorFromEntity({
        trigger: s.trigger,
        entityAt: newAnchorAt,
        offsetDays: s.offsetDays ?? 0,
        allDay: s.allDay,
        timezone,
      });
      const moved = await this.prisma.notificationSchedule.update({
        where: { id: s.id },
        data: { baseAnchorAt: anchor, anchorAt: anchor, seriesIndex: 0 },
      });
      if (moved.status === 'ACTIVE') {
        toEnqueue.push(
          ...(await this.applyPlan(moved, timezone, now, 'EDITED')),
        );
      }
    }
    await this.enqueueAfterCommit(toEnqueue);
    return toEnqueue;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Manual (USER) schedules. Input is already validated by the caller (B03); these enqueue for themselves.
  // ---------------------------------------------------------------------------------------------------------------

  async createManual(
    farmId: string,
    userId: string,
    input: ManualScheduleInput,
  ): Promise<NotificationSchedule> {
    const leads = normalizeLeads(input.leadMinutes);
    const leadError = validateLeads(leads, input.allDay);
    if (leadError) throw new BadRequestException(leadError);
    const timezone = await this.farmClock.timezone(farmId);
    const schedule = await this.prisma.notificationSchedule.create({
      data: {
        farmId,
        origin: 'USER',
        createdBy: userId,
        status: 'ACTIVE',
        title: input.title,
        body: input.body ?? null,
        category: input.category ?? MANUAL_DEFAULT_CATEGORY,
        priority: input.priority ?? MANUAL_DEFAULT_PRIORITY,
        eventKey: 'custom_reminder',
        trigger: input.trigger,
        baseAnchorAt: input.baseAnchorAt,
        anchorAt: input.baseAnchorAt,
        allDay: input.allDay,
        sendTime: input.sendTime ?? '08:00',
        leadMinutes: leads,
        offsetDays: input.offsetDays ?? null,
        repeat: input.repeat ?? 'NONE',
        repeatInterval: input.repeatInterval ?? null,
        repeatEndDate: input.repeatEndDate ?? null,
        audienceMode: input.audienceMode,
        audienceUserIds: input.audienceUserIds ?? [],
        audienceRoles: input.audienceRoles ?? [],
        animalIds: input.animalIds ?? [],
        anchorType: input.anchorType ?? null,
        anchorId: input.anchorId ?? null,
      },
    });
    const toEnqueue = await this.applyPlan(
      schedule,
      timezone,
      this.clock.now(),
      'EDITED',
    );
    if (toEnqueue.length === 0) {
      // Entirely in the past: nothing could ever fire.
      await this.prisma.notificationSchedule.delete({
        where: { id: schedule.id },
      });
      throw new UnprocessableEntityException('NO_FUTURE_OCCURRENCE');
    }
    await this.enqueueAfterCommit(toEnqueue);
    return this.prisma.notificationSchedule.findUniqueOrThrow({
      where: { id: schedule.id },
    });
  }

  /** Date, time, repeat, leads or audience edits: pending occurrences are cancelled (EDITED) and recomputed. */
  async updateManual(
    farmId: string,
    scheduleId: string,
    patch: Partial<ManualScheduleInput>,
  ): Promise<NotificationSchedule> {
    const current = await this.getManual(farmId, scheduleId);
    if (patch.leadMinutes) {
      const leads = normalizeLeads(patch.leadMinutes);
      const err = validateLeads(leads, patch.allDay ?? current.allDay);
      if (err) throw new BadRequestException(err);
    }
    const data: Prisma.NotificationScheduleUpdateInput = {};
    if (patch.title !== undefined) data.title = patch.title;
    if (patch.body !== undefined) data.body = patch.body;
    if (patch.category !== undefined) data.category = patch.category;
    if (patch.priority !== undefined) data.priority = patch.priority;
    if (patch.trigger !== undefined) data.trigger = patch.trigger;
    if (patch.baseAnchorAt !== undefined) {
      data.baseAnchorAt = patch.baseAnchorAt;
      data.anchorAt = patch.baseAnchorAt;
      data.seriesIndex = 0;
    }
    if (patch.allDay !== undefined) data.allDay = patch.allDay;
    if (patch.sendTime !== undefined) data.sendTime = patch.sendTime;
    if (patch.leadMinutes !== undefined) {
      data.leadMinutes = normalizeLeads(patch.leadMinutes);
    }
    if (patch.offsetDays !== undefined) data.offsetDays = patch.offsetDays;
    if (patch.anchorType !== undefined) data.anchorType = patch.anchorType;
    if (patch.anchorId !== undefined) data.anchorId = patch.anchorId;
    if (patch.repeat !== undefined) data.repeat = patch.repeat;
    if (patch.repeatInterval !== undefined) {
      data.repeatInterval = patch.repeatInterval;
    }
    if (patch.repeatEndDate !== undefined) {
      data.repeatEndDate = patch.repeatEndDate;
    }
    if (patch.audienceMode !== undefined) {
      data.audienceMode = patch.audienceMode;
    }
    if (patch.audienceUserIds !== undefined) {
      data.audienceUserIds = patch.audienceUserIds;
    }
    if (patch.audienceRoles !== undefined) {
      data.audienceRoles = patch.audienceRoles;
    }
    if (patch.animalIds !== undefined) data.animalIds = patch.animalIds;

    const updated = await this.prisma.notificationSchedule.update({
      where: { id: current.id },
      data,
    });
    if (updated.status === 'ACTIVE') {
      const timezone = await this.farmClock.timezone(farmId);
      const toEnqueue = await this.applyPlan(
        updated,
        timezone,
        this.clock.now(),
        'EDITED',
      );
      await this.enqueueAfterCommit(toEnqueue);
    }
    return this.prisma.notificationSchedule.findUniqueOrThrow({
      where: { id: current.id },
    });
  }

  async pause(farmId: string, scheduleId: string): Promise<void> {
    const s = await this.getManual(farmId, scheduleId);
    await this.cancelPending(s.id, 'PAUSED');
    await this.prisma.notificationSchedule.update({
      where: { id: s.id },
      data: { status: 'PAUSED' },
    });
  }

  /** Recomputes from now (a repeating series continues at its next anchor >= now). */
  async resume(farmId: string, scheduleId: string): Promise<void> {
    const s = await this.getManual(farmId, scheduleId);
    const timezone = await this.farmClock.timezone(farmId);
    const active = await this.prisma.notificationSchedule.update({
      where: { id: s.id },
      data: { status: 'ACTIVE' },
    });
    const toEnqueue = await this.applyPlan(
      active,
      timezone,
      this.clock.now(),
      'EDITED',
    );
    await this.enqueueAfterCommit(toEnqueue);
  }

  async cancel(farmId: string, scheduleId: string): Promise<void> {
    const s = await this.getManual(farmId, scheduleId);
    await this.cancelPending(s.id, 'EDITED');
    await this.prisma.notificationSchedule.update({
      where: { id: s.id },
      data: { status: 'CANCELLED' },
    });
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Queue
  // ---------------------------------------------------------------------------------------------------------------

  /** Producers call this AFTER their transaction commits. Only occurrences due within 48 h get a job. */
  async enqueueAfterCommit(occurrenceIds: string[]): Promise<void> {
    if (occurrenceIds.length === 0) return;
    const rows = await this.prisma.notificationOccurrence.findMany({
      where: { id: { in: occurrenceIds }, status: 'SCHEDULED' },
      select: { id: true, fireAt: true },
    });
    const now = this.clock.now();
    const horizon = now.getTime() + ENQUEUE_HORIZON_MS;
    for (const row of rows) {
      if (row.fireAt.getTime() >= horizon) continue;
      await this.addJob(row.id, row.fireAt, now);
    }
  }

  private async addJob(id: string, fireAt: Date, now: Date): Promise<boolean> {
    try {
      await this.queue.add(id, Math.max(0, fireAt.getTime() - now.getTime()));
      return true;
    } catch (err) {
      // Row stays SCHEDULED without a job; the boot/05:00 reconcile enqueues it.
      this.log.warn('Queue add failed; reconcile will retry', {
        occurrenceId: id,
        error: err instanceof Error ? err.message : String(err),
      });
      return false;
    }
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Series advance (called by the processor and by reconcile)
  // ---------------------------------------------------------------------------------------------------------------

  /**
   * §3.3 step 7. When the schedule has no pending occurrence left, creates the next anchor's occurrences (a repeating
   * series) or marks it DONE. Returns true when it did something.
   */
  async advance(scheduleId: string): Promise<boolean> {
    const s = await this.prisma.notificationSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!s || s.status !== 'ACTIVE') return false;
    const pending = await this.prisma.notificationOccurrence.count({
      where: { scheduleId, status: 'SCHEDULED' },
    });
    if (pending > 0) return false;

    const now = this.clock.now();
    const timezone = await this.farmClock.timezone(s.farmId);
    const next = advanceSeries(this.seriesOf(s, timezone), s.seriesIndex, now);
    if (!next) {
      await this.prisma.notificationSchedule.update({
        where: { id: s.id },
        data: { status: 'DONE' },
      });
      return true;
    }
    await this.prisma.notificationSchedule.update({
      where: { id: s.id },
      data: { anchorAt: next.anchorAt, seriesIndex: next.seriesIndex },
    });
    const ids: string[] = [];
    for (const p of next.occurrences) {
      ids.push(await this.ensureOccurrence(s, p));
    }
    await this.enqueueAfterCommit(ids);
    return true;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Reconcile (§3.6)
  // ---------------------------------------------------------------------------------------------------------------

  /**
   * Boot and 05:00 durability backstop. Idempotent and safe on several instances. Steps: missing jobs, orphan jobs,
   * stalled series, then (daily run only) purge.
   */
  async reconcile(
    now: Date = this.clock.now(),
    opts: { purge?: boolean } = {},
  ): Promise<{
    enqueued: number;
    removed: number;
    advanced: number;
    purged: number;
  }> {
    const result = { enqueued: 0, removed: 0, advanced: 0, purged: 0 };
    const jobIds = new Set(await this.queue.liveJobIds());
    const horizon = new Date(now.getTime() + ENQUEUE_HORIZON_MS);

    // 2. Missing jobs (past-due ones included: the worker applies the late rule, one code path for "late").
    let cursor: string | undefined;
    for (;;) {
      const rows = await this.prisma.notificationOccurrence.findMany({
        where: { status: 'SCHEDULED', fireAt: { lt: horizon } },
        orderBy: { id: 'asc' },
        take: PAGE,
        ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
        select: { id: true, fireAt: true },
      });
      for (const row of rows) {
        if (jobIds.has(row.id)) continue;
        if (await this.addJob(row.id, row.fireAt, now)) {
          jobIds.add(row.id);
          result.enqueued++;
        }
      }
      if (rows.length < PAGE) break;
      cursor = rows[rows.length - 1].id;
    }

    // 3. Orphan jobs: queued ids whose occurrence is not SCHEDULED (or no longer exists).
    if (jobIds.size > 0) {
      const all = [...jobIds];
      const scheduled = new Set<string>();
      for (let i = 0; i < all.length; i += PURGE_BATCH) {
        const rows = await this.prisma.notificationOccurrence.findMany({
          where: {
            id: { in: all.slice(i, i + PURGE_BATCH) },
            status: 'SCHEDULED',
          },
          select: { id: true },
        });
        for (const r of rows) scheduled.add(r.id);
      }
      for (const id of all) {
        if (scheduled.has(id)) continue;
        await this.queue.remove(id);
        jobIds.delete(id);
        result.removed++;
      }
    }

    // 4. Stalled series: ACTIVE with nothing left to fire.
    for (;;) {
      const stalled = await this.prisma.notificationSchedule.findMany({
        where: {
          status: 'ACTIVE',
          occurrences: { none: { status: 'SCHEDULED' } },
        },
        select: { id: true },
        take: PAGE,
      });
      let progressed = 0;
      for (const s of stalled) {
        if (await this.advance(s.id)) progressed++;
      }
      result.advanced += progressed;
      if (stalled.length < PAGE || progressed === 0) break;
    }

    // 5. Purge (daily run only).
    if (opts.purge) result.purged = await this.purge(now);

    this.metrics.recordNotificationReconcile('enqueued', result.enqueued);
    this.metrics.recordNotificationReconcile('removed', result.removed);
    this.metrics.recordNotificationReconcile('advanced', result.advanced);
    this.metrics.recordNotificationReconcile('purged', result.purged);
    this.metrics.setNotificationQueueDelayed(jobIds.size);
    if (result.enqueued > 0 || result.removed > 0 || result.advanced > 0) {
      this.log.info('Notification reconcile repaired drift', result);
    }
    return result;
  }

  private async purge(now: Date): Promise<number> {
    let purged = 0;
    const occCutoff = new Date(now.getTime() - OCCURRENCE_RETENTION_MS);
    for (;;) {
      const rows = await this.prisma.notificationOccurrence.findMany({
        where: {
          status: { in: ['FIRED', 'SKIPPED', 'CANCELLED'] },
          fireAt: { lt: occCutoff },
        },
        select: { id: true },
        take: PURGE_BATCH,
      });
      if (rows.length === 0) break;
      const { count } = await this.prisma.notificationOccurrence.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
      purged += count;
      if (rows.length < PURGE_BATCH) break;
    }
    const schCutoff = new Date(now.getTime() - SCHEDULE_RETENTION_MS);
    for (;;) {
      const rows = await this.prisma.notificationSchedule.findMany({
        where: {
          status: { in: ['DONE', 'CANCELLED'] },
          updatedAt: { lt: schCutoff },
          occurrences: { none: {} },
        },
        select: { id: true },
        take: PURGE_BATCH,
      });
      if (rows.length === 0) break;
      const { count } = await this.prisma.notificationSchedule.deleteMany({
        where: { id: { in: rows.map((r) => r.id) } },
      });
      purged += count;
      if (rows.length < PURGE_BATCH) break;
    }
    return purged;
  }

  // ---------------------------------------------------------------------------------------------------------------
  // Internals
  // ---------------------------------------------------------------------------------------------------------------

  private seriesOf(s: NotificationSchedule, timezone: string) {
    return {
      baseAnchorAt: s.baseAnchorAt,
      allDay: s.allDay,
      repeat: s.repeat,
      repeatInterval: s.repeatInterval,
      repeatEndDate: s.repeatEndDate,
      timezone,
      sendTime: s.sendTime,
      leadMinutes: s.leadMinutes,
    };
  }

  /**
   * Recomputes the live plan from the series base and makes the table match: pending occurrences that are not in the
   * plan are cancelled with `cancelReason`; planned ones are created, revived (CANCELLED) or re-timed. FIRED and
   * SKIPPED rows are final and never resurrected. Returns the ids that need a queue job (the caller enqueues them).
   */
  private async applyPlan(
    s: NotificationSchedule,
    timezone: string,
    now: Date,
    cancelReason: string,
  ): Promise<string[]> {
    const start = firstLiveAnchor(this.seriesOf(s, timezone), 0, now);
    const planned = start?.occurrences ?? [];
    const keyOf = (anchor: Date, lead: number) => `${anchor.getTime()}:${lead}`;
    const plannedKeys = new Set(
      planned.map((p) => keyOf(p.anchorAt, p.leadMinutes)),
    );

    const existing = await this.prisma.notificationOccurrence.findMany({
      where: { scheduleId: s.id },
    });
    const byKey = new Map(
      existing.map((o) => [keyOf(o.anchorAt, o.leadMinutes), o]),
    );

    const stale = existing.filter(
      (o) =>
        o.status === 'SCHEDULED' &&
        !plannedKeys.has(keyOf(o.anchorAt, o.leadMinutes)),
    );
    if (stale.length > 0) {
      await this.cancelOccurrences(
        stale.map((o) => o.id),
        cancelReason,
      );
    }

    const toEnqueue: string[] = [];
    for (const p of planned) {
      const ex = byKey.get(keyOf(p.anchorAt, p.leadMinutes));
      if (!ex) {
        toEnqueue.push(await this.ensureOccurrence(s, p));
        continue;
      }
      if (ex.status === 'FIRED' || ex.status === 'SKIPPED') continue;
      const fireAt = applyJitter(p.fireAt, ex.id, s.origin);
      if (
        ex.status === 'SCHEDULED' &&
        ex.fireAt.getTime() === fireAt.getTime()
      ) {
        continue;
      }
      if (ex.status === 'SCHEDULED') await this.safeRemove(ex.id);
      await this.prisma.notificationOccurrence.update({
        where: { id: ex.id },
        data: { status: 'SCHEDULED', fireAt, reason: null },
      });
      toEnqueue.push(ex.id);
    }

    await this.prisma.notificationSchedule.update({
      where: { id: s.id },
      data: {
        status: start || s.status === 'PAUSED' ? s.status : 'DONE',
        anchorAt: start?.anchorAt ?? s.anchorAt,
        seriesIndex: start?.seriesIndex ?? s.seriesIndex,
      },
    });
    return toEnqueue;
  }

  /** Race-safe create by the unique `(scheduleId, anchorAt, leadMinutes)`; returns the row id. */
  private async ensureOccurrence(
    s: NotificationSchedule,
    p: PlannedOccurrence,
  ): Promise<string> {
    const id = randomUUID();
    const row: NotificationOccurrence =
      await this.prisma.notificationOccurrence.upsert({
        where: {
          scheduleId_anchorAt_leadMinutes: {
            scheduleId: s.id,
            anchorAt: p.anchorAt,
            leadMinutes: p.leadMinutes,
          },
        },
        create: {
          id,
          scheduleId: s.id,
          farmId: s.farmId,
          anchorAt: p.anchorAt,
          leadMinutes: p.leadMinutes,
          fireAt: applyJitter(p.fireAt, id, s.origin),
        },
        update: {},
      });
    return row.id;
  }

  private async cancelPending(
    scheduleId: string,
    reason: string,
  ): Promise<void> {
    const rows = await this.prisma.notificationOccurrence.findMany({
      where: { scheduleId, status: 'SCHEDULED' },
      select: { id: true },
    });
    await this.cancelOccurrences(
      rows.map((r) => r.id),
      reason,
    );
  }

  private async cancelOccurrences(
    ids: string[],
    reason: string,
  ): Promise<void> {
    if (ids.length === 0) return;
    const { count } = await this.prisma.notificationOccurrence.updateMany({
      where: { id: { in: ids }, status: 'SCHEDULED' },
      data: { status: 'CANCELLED', reason },
    });
    for (const id of ids) await this.safeRemove(id);
    for (let i = 0; i < count; i++) {
      this.metrics.recordNotificationOccurrence('cancelled', reason);
    }
  }

  private async safeRemove(id: string): Promise<void> {
    try {
      await this.queue.remove(id);
    } catch (err) {
      this.log.warn('Queue remove failed; reconcile will clean up', {
        occurrenceId: id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  private async getManual(
    farmId: string,
    scheduleId: string,
  ): Promise<NotificationSchedule> {
    const s = await this.prisma.notificationSchedule.findFirst({
      where: { id: scheduleId, farmId },
    });
    if (!s) throw new NotFoundException('Schedule not found');
    if (s.origin !== 'USER') {
      throw new ConflictException('System schedules are read-only');
    }
    return s;
  }

  private async tzFor(farmId: string, cache: Map<string, string>) {
    let tz = cache.get(farmId);
    if (!tz) {
      tz = await this.farmClock.timezone(farmId);
      cache.set(farmId, tz);
    }
    return tz;
  }
}

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    (err as { code?: string }).code === 'P2002'
  );
}
