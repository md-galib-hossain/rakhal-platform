import { Injectable } from '@nestjs/common';
import { Prisma, TaskCategory } from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { dayKey, localDateIso } from 'src/common/farm-time/farm-time';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import { TaskService } from 'src/modules/task/application/services/task.service';
import { ruleByKey } from '../../domain/follow-up-rules';
import {
  decideReminder,
  FOLLOW_UP_LEAD_DAYS,
  REMINDER_OVERDUE_MAX_DAYS,
  ReminderStage,
  STAGE_EVENT_KEY,
} from '../../domain/reminder-cadence';

const DAY_MS = 24 * 60 * 60 * 1000;
const OPEN = ['PENDING', 'IN_PROGRESS', 'BLOCKED'] as const;
const DEFAULT_ROLES = ['Owner', 'Manager'];
/** Longest lead notice a reminder may carry (the DTO caps it too). */
const MAX_LEAD_DAYS = 90;

const TASK_SELECT = {
  id: true,
  farmId: true,
  name: true,
  category: true,
  ruleKey: true,
  sourceEventId: true,
  dueAt: true,
  remindDaysBefore: true,
  notifyRoleNames: true,
  assignedToId: true,
  relatedCattleId: true,
  recurring: true,
  spawnedNextAt: true,
  cattles: { select: { cattleId: true } },
  recipients: { select: { userId: true } },
} satisfies Prisma.TaskSelect;

type Row = Prisma.TaskGetPayload<{ select: typeof TASK_SELECT }>;

interface Bucket {
  stage: ReminderStage;
  groupKey: string;
  label: string;
  ruleKey: string | null;
  isReminder: boolean;
  taskIds: Set<string>;
  sourceEventId: string | null;
  dueYmd: string;
  daysUntil: number;
  cattleIds: Set<string>;
  userIds: Set<string>;
}

/**
 * RAKHAL-485: the one sweep that turns Task Hub follow-ups (rule tasks) and custom reminders
 * (category REMINDER) into notifications. One entry in the existing 05:00 cron (no scheduler of
 * its own); it replaces the four bespoke calving / heat / pregnancy-check / dry-off sweeps.
 *
 * On the farm's calendar day it sends: a day-before notice for rule tasks (a reminder uses its
 * own `remindDaysBefore`), a notice on the day, then a daily overdue nag for up to 30 days. One
 * notification per (rule or reminder, stage, due day), never one per animal. Idempotent by
 * `dedupeKey`, so a second run the same day sends nothing new. A repeating reminder spawns its
 * next occurrence here, once, when it fires.
 */
@Injectable()
export class FollowUpReminderService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly clock: FarmClockService,
    private readonly tasks: TaskService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(FollowUpReminderService.name);
  }

  /** Returns how many notifications were created. One broken farm never stops the others. */
  async sweepAll(now = new Date()): Promise<number> {
    const rows = await this.prisma.task.findMany({
      where: {
        status: { in: [...OPEN] },
        OR: [{ ruleKey: { not: null } }, { category: TaskCategory.REMINDER }],
        dueAt: {
          gte: new Date(
            now.getTime() - (REMINDER_OVERDUE_MAX_DAYS + 2) * DAY_MS,
          ),
          lt: new Date(now.getTime() + (MAX_LEAD_DAYS + 2) * DAY_MS),
        },
      },
      select: TASK_SELECT,
    });
    const byFarm = new Map<string, Row[]>();
    for (const r of rows) {
      byFarm.set(r.farmId, [...(byFarm.get(r.farmId) ?? []), r]);
    }

    let sent = 0;
    for (const [farmId, farmRows] of byFarm) {
      try {
        sent += await this.sweepFarm(farmId, farmRows, now);
      } catch (err) {
        this.log.error('Follow-up reminder sweep failed for a farm', {
          farmId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return sent;
  }

  private daysUntil(due: Date, timezone: string, now: Date): number {
    const dueDay = dayKey(localDateIso(timezone, due)).getTime();
    const today = dayKey(localDateIso(timezone, now)).getTime();
    return Math.round((dueDay - today) / DAY_MS);
  }

  private async sweepFarm(
    farmId: string,
    rows: Row[],
    now: Date,
  ): Promise<number> {
    const timezone = await this.clock.timezone(farmId);

    // Animals that left the herd drop out (a disposed cow keeps no reminders).
    const allCattleIds = [...new Set(rows.flatMap((r) => this.cattleIdsOf(r)))];
    const cattle = allCattleIds.length
      ? await this.prisma.cattle.findMany({
          where: {
            id: { in: allCattleIds },
            farmId,
            herdStatus: 'ACTIVE',
            deletedAt: null,
          },
          select: { id: true, tagNumber: true, name: true },
        })
      : [];
    const cattleById = new Map(cattle.map((c) => [c.id, c]));

    const members = await this.prisma.farmMember.findMany({
      where: { farmId },
      select: { userId: true, role: { select: { name: true } } },
    });

    const buckets = new Map<string, Bucket>();
    for (const row of rows) {
      const daysUntil = this.daysUntil(row.dueAt, timezone, now);
      const isReminder = row.category === TaskCategory.REMINDER;

      // A repeating reminder spawns its next occurrence the day it fires (once, atomically).
      if (isReminder && row.recurring && !row.spawnedNextAt && daysUntil <= 0) {
        await this.tasks.spawnNextReminder(row.id);
      }

      const decision = decideReminder(
        daysUntil,
        isReminder ? row.remindDaysBefore : FOLLOW_UP_LEAD_DAYS,
      );
      if (!decision) continue;

      const ids = this.cattleIdsOf(row);
      const live = ids.filter((id) => cattleById.has(id));
      if (ids.length > 0 && live.length === 0) continue;

      const groupKey = isReminder ? `task:${row.id}` : `rule:${row.ruleKey}`;
      const dueYmd = localDateIso(timezone, row.dueAt);
      const bucketKey =
        decision.stage === 'OVERDUE'
          ? `${groupKey}|OVERDUE`
          : `${groupKey}|${decision.stage}|${dueYmd}`;
      const recipients = this.recipientsOf(row, members);

      const existing = buckets.get(bucketKey);
      if (existing) {
        existing.taskIds.add(row.id);
        live.forEach((id) => existing.cattleIds.add(id));
        recipients.forEach((u) => existing.userIds.add(u));
        if (dueYmd < existing.dueYmd) existing.dueYmd = dueYmd;
        if (decision.stage === 'OVERDUE') {
          existing.daysUntil = Math.min(existing.daysUntil, daysUntil);
        }
        continue;
      }
      buckets.set(bucketKey, {
        stage: decision.stage,
        groupKey,
        label: isReminder
          ? row.name
          : (ruleByKey(row.ruleKey ?? '')?.title ?? row.name),
        ruleKey: row.ruleKey,
        isReminder,
        taskIds: new Set([row.id]),
        sourceEventId: row.sourceEventId,
        dueYmd,
        daysUntil,
        cattleIds: new Set(live),
        userIds: new Set(recipients),
      });
    }

    const todayYmd = localDateIso(timezone, now);
    let sent = 0;
    for (const bucket of buckets.values()) {
      sent += await this.notify(farmId, bucket, todayYmd, cattleById);
    }
    return sent;
  }

  private cattleIdsOf(row: Row): string[] {
    return [
      ...new Set([
        ...(row.relatedCattleId ? [row.relatedCattleId] : []),
        ...row.cattles.map((c) => c.cattleId),
      ]),
    ];
  }

  /** Assignee + named users + roles; Owner and Manager when none is set. */
  private recipientsOf(
    row: Row,
    members: { userId: string; role: { name: string } }[],
  ): string[] {
    const explicit = new Set<string>([
      ...(row.assignedToId ? [row.assignedToId] : []),
      ...row.recipients.map((r) => r.userId),
    ]);
    const roles =
      row.notifyRoleNames.length > 0
        ? row.notifyRoleNames
        : explicit.size === 0
          ? DEFAULT_ROLES
          : [];
    for (const m of members) {
      if (roles.includes(m.role.name)) explicit.add(m.userId);
    }
    return [...explicit];
  }

  /**
   * What tapping the notification does (RFE-165 reads `link` alone; `data` is for other clients).
   * One animal, one task: open that animal's event form (`record` = the event type the task asks
   * for) or, for a reminder, its workspace. Several tasks or animals: the filtered Animals list.
   * A reminder with no animal is info only.
   */
  private action(bucket: Bucket): {
    link?: string;
    data: Record<string, unknown>;
  } {
    const taskIds = [...bucket.taskIds];
    const cattleIds = [...bucket.cattleIds];
    const single = taskIds.length === 1 && cattleIds.length === 1;
    if (single) {
      const cattleId = cattleIds[0];
      const taskId = taskIds[0];
      const eventType = bucket.isReminder
        ? null
        : (ruleByKey(bucket.ruleKey ?? '')?.completesOn[0] ?? null);
      const q = new URLSearchParams({ view: cattleId });
      if (eventType) q.set('record', eventType);
      q.set('reminder', taskId);
      return {
        link: `/animals?${q.toString()}`,
        data: {
          cattleId,
          taskId,
          ruleKey: bucket.ruleKey,
          eventType,
          sourceEventId: bucket.sourceEventId,
        },
      };
    }
    const data = {
      ruleKey: bucket.ruleKey,
      taskIds,
      count: bucket.isReminder ? cattleIds.length : taskIds.length,
    };
    if (bucket.isReminder) {
      // A farm-wide reminder has no animal to open: info only.
      return cattleIds.length === 0
        ? { data }
        : { link: `/animals?due=REMINDER&reminder=${taskIds[0]}`, data };
    }
    return { link: `/animals?due=${bucket.ruleKey}`, data };
  }

  private animalsText(
    bucket: Bucket,
    cattleById: Map<string, { tagNumber: string; name: string | null }>,
  ): string {
    const tags = [...bucket.cattleIds].map(
      (id) => cattleById.get(id)?.tagNumber ?? id,
    );
    if (tags.length === 0) return 'farm-wide';
    if (tags.length <= 3) return tags.join(', ');
    return `${tags.slice(0, 3).join(', ')} +${tags.length - 3} more`;
  }

  private async notify(
    farmId: string,
    bucket: Bucket,
    todayYmd: string,
    cattleById: Map<string, { tagNumber: string; name: string | null }>,
  ): Promise<number> {
    if (bucket.userIds.size === 0) return 0;
    const animals = this.animalsText(bucket, cattleById);
    const days =
      bucket.stage === 'OVERDUE' ? -bucket.daysUntil : bucket.daysUntil;
    const title =
      bucket.stage === 'UPCOMING'
        ? `Coming up in ${days} day(s): ${bucket.label}`
        : bucket.stage === 'DUE_TODAY'
          ? `Due today: ${bucket.label}`
          : `Overdue: ${bucket.label}`;
    const created = await this.notifications.notifyUsers({
      farmId,
      userIds: [...bucket.userIds],
      eventKey: STAGE_EVENT_KEY[bucket.stage],
      title,
      message: `${bucket.label}: ${animals}, ${bucket.stage === 'OVERDUE' ? 'overdue since' : 'due'} ${bucket.dueYmd}.`,
      params: { label: bucket.label, animals, date: bucket.dueYmd, days },
      ...this.action(bucket),
      dedupeKey:
        bucket.stage === 'OVERDUE'
          ? `fu:${bucket.groupKey}:OVERDUE:${todayYmd}`
          : `fu:${bucket.groupKey}:${bucket.stage}:${bucket.dueYmd}`,
    });
    return created.length;
  }
}
