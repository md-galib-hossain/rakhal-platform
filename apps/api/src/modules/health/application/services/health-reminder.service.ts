import { Injectable } from '@nestjs/common';
import {
  HealthCaseStatus,
  HealthTaskStatus,
  HerdStatus,
  PlanEnrollmentStatus,
  Prisma,
} from '@prisma/client';
import { localDateIso } from 'src/common/farm-time/farm-time';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';
import {
  farmDaysUntil,
  HealthReminderStage,
  OVERDUE_EVENT_KEY,
  OVERDUE_MAX_DAYS,
  reminderFor,
  STAGE_EVENT_KEY,
} from '../../domain/health-reminder-cadence';

const DAY_MS = 24 * 60 * 60 * 1000;

/** A step that can still be acted on. `RESCHEDULED` keeps a live status with a new `dueDateTime`. */
const LIVE_TASK_STATUSES = [
  HealthTaskStatus.PENDING,
  HealthTaskStatus.RESCHEDULED,
  HealthTaskStatus.OVERDUE,
];
const ACTIVE_CASE_STATUSES = [
  HealthCaseStatus.ACTIVE,
  HealthCaseStatus.IMPROVING,
  HealthCaseStatus.WORSENING,
  HealthCaseStatus.STABLE,
];

/** Selected once so the service and the row type it builds buckets from can never drift apart. */
const TASK_SELECT = {
  id: true,
  cattleId: true,
  title: true,
  dueDateTime: true,
  healthCaseId: true,
  cattle: { select: { name: true, tagNumber: true } },
  healthCase: { select: { healthPlan: { select: { name: true } } } },
  planEnrollment: {
    select: {
      planApplicationId: true,
      healthPlan: { select: { name: true } },
    },
  },
  healthPlan: { select: { name: true } },
} satisfies Prisma.HealthTaskSelect;

type TaskRow = Prisma.HealthTaskGetPayload<{ select: typeof TASK_SELECT }>;

/** One notification's worth of steps: same round (or same case), same stage, same due day. */
interface Bucket {
  stage: HealthReminderStage | null;
  groupKey: string;
  /** `true` for a case-backed (curative) group — the label then names the animal. */
  curative: boolean;
  planName: string;
  animalLabel: string;
  cattleIds: Set<string>;
  /** Farm-local `YYYY-MM-DD` of the earliest due step in the bucket. */
  dueYmd: string;
  daysUntil: number;
  maxDaysOverdue: number;
}

/**
 * Reminders for scheduled health steps (RAKHAL-465, MILESTONE 29 / ADR-029, PRD §13.9). Protocol steps live in
 * `HealthTask`, which is deliberately **not** mirrored into the Task Hub's `Task` table — the existing overdue /
 * today's-tasks sweeps never saw them, so a booster due on Friday sent nothing. Run by the 5 AM `SchedulerService`
 * cron as one list entry (same shape as `FeedPlanFitSweepService.sweepAll`).
 *
 * For every open step of an animal still in the active herd (curative: case still open; preventive: enrollment
 * still ACTIVE) it sends, on the farm's local calendar day:
 *  - at T-7, T-3, T-1 and on the day — ONE notification per (round | case, stage, due day), never one per animal;
 *  - once the day has passed — ONE daily overdue notification per round | case, for up to `OVERDUE_MAX_DAYS`.
 *
 * Idempotent by `dedupeKey`. The stage key contains the due day, so rescheduling a step re-arms its reminders for
 * the new date with no bookkeeping; the overdue key contains today, so it repeats daily and never twice in a day.
 * No back-fill: a stage is sent only on the day `daysUntil` equals it. Recipients: Owner + Manager (workers see
 * due work on the Schedule tab). One broken farm never stops the others.
 */
@Injectable()
export class HealthReminderService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly clock: FarmClockService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(HealthReminderService.name);
  }

  /** Every farm with an open step near enough to matter. Returns how many notifications were created. */
  async sweepAll(now = new Date()): Promise<number> {
    const farms = await this.prisma.healthTask.findMany({
      where: this.liveWhere(now),
      select: { farmId: true },
      distinct: ['farmId'],
    });
    let sent = 0;
    for (const { farmId } of farms) {
      try {
        sent += await this.sweepFarm(farmId, now);
      } catch (err) {
        this.log.error('Health reminder sweep failed for a farm', {
          farmId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return sent;
  }

  async sweepFarm(farmId: string, now = new Date()): Promise<number> {
    const timezone = await this.clock.timezone(farmId);
    const tasks = await this.prisma.healthTask.findMany({
      where: { ...this.liveWhere(now), farmId },
      select: TASK_SELECT,
    });

    const buckets = new Map<string, Bucket>();
    for (const task of tasks) {
      const daysUntil = farmDaysUntil(task.dueDateTime, timezone, now);
      const decision = reminderFor(daysUntil);
      if (!decision) continue;

      const groupKey = task.planEnrollment
        ? `app:${task.planEnrollment.planApplicationId}`
        : task.healthCaseId
          ? `case:${task.healthCaseId}`
          : `task:${task.id}`;
      const dueYmd = localDateIso(timezone, task.dueDateTime);
      const stage = decision.kind === 'stage' ? decision.stage : null;
      const bucketKey =
        decision.kind === 'stage'
          ? `${groupKey}|${decision.stage}|${dueYmd}`
          : `${groupKey}|overdue`;

      const existing = buckets.get(bucketKey);
      if (existing) {
        existing.cattleIds.add(task.cattleId);
        if (dueYmd < existing.dueYmd) existing.dueYmd = dueYmd;
        if (decision.kind === 'overdue') {
          existing.maxDaysOverdue = Math.max(
            existing.maxDaysOverdue,
            decision.daysOverdue,
          );
        }
        continue;
      }
      buckets.set(bucketKey, {
        stage,
        groupKey,
        curative: !task.planEnrollment,
        planName: this.planNameOf(task),
        animalLabel: task.cattle.name ?? task.cattle.tagNumber,
        cattleIds: new Set([task.cattleId]),
        dueYmd,
        daysUntil,
        maxDaysOverdue: decision.kind === 'overdue' ? decision.daysOverdue : 0,
      });
    }

    const todayYmd = localDateIso(timezone, now);
    let sent = 0;
    for (const bucket of buckets.values()) {
      sent += await this.notify(farmId, bucket, todayYmd);
    }
    return sent;
  }

  private async notify(
    farmId: string,
    bucket: Bucket,
    todayYmd: string,
  ): Promise<number> {
    const count = bucket.cattleIds.size;
    const label = bucket.curative
      ? `${bucket.planName} · ${bucket.animalLabel}`
      : bucket.planName;
    const params = {
      label,
      count,
      date: bucket.dueYmd,
      days: bucket.stage === null ? bucket.maxDaysOverdue : bucket.daysUntil,
    };

    if (bucket.stage === null) {
      const created = await this.notifications.notifyOwnersAndManagers({
        farmId,
        eventKey: OVERDUE_EVENT_KEY,
        title: 'Health Step Overdue',
        message: `${label}: ${count} animal(s) overdue since ${bucket.dueYmd}.`,
        params,
        // RFE-143: the Schedule tab is gone; Protocols is where due steps are recorded. `bucket`/`date` are kept so the link stays self-describing.
        link: '/healthcare?healthTab=protocols&bucket=overdue',
        dedupeKey: `${OVERDUE_EVENT_KEY}:${bucket.groupKey}:${todayYmd}`,
      });
      return created.length;
    }

    const title =
      bucket.stage === 'DAY_OF'
        ? 'Health Step Due Today'
        : bucket.stage === 'T_MINUS_1'
          ? 'Health Step Due Tomorrow'
          : `Health Step Due in ${bucket.daysUntil} Days`;
    const created = await this.notifications.notifyOwnersAndManagers({
      farmId,
      eventKey: STAGE_EVENT_KEY[bucket.stage],
      title,
      message: `${label}: ${count} animal(s), due ${bucket.dueYmd}.`,
      params,
      link: `/healthcare?healthTab=protocols&date=${bucket.dueYmd}`,
      dedupeKey: `health_task:${bucket.groupKey}:${bucket.dueYmd}:${bucket.stage}`,
    });
    return created.length;
  }

  private planNameOf(task: TaskRow): string {
    return (
      task.planEnrollment?.healthPlan.name ??
      task.healthCase?.healthPlan?.name ??
      task.healthPlan?.name ??
      task.title
    );
  }

  /**
   * Open steps on live animals inside the window the cadence can act on. The window is widened by two days each
   * side of the exact -30…+7 farm-day range (timezone offsets reach ±14 h); `reminderFor` does the exact cut.
   */
  private liveWhere(now: Date): Prisma.HealthTaskWhereInput {
    return {
      deletedAt: null,
      status: { in: LIVE_TASK_STATUSES },
      dueDateTime: {
        gte: new Date(now.getTime() - (OVERDUE_MAX_DAYS + 2) * DAY_MS),
        lt: new Date(now.getTime() + 9 * DAY_MS),
      },
      cattle: { herdStatus: HerdStatus.ACTIVE, deletedAt: null },
      OR: [
        {
          healthCase: {
            is: { status: { in: ACTIVE_CASE_STATUSES }, deletedAt: null },
          },
        },
        {
          planEnrollment: {
            is: { status: PlanEnrollmentStatus.ACTIVE, deletedAt: null },
          },
        },
      ],
    };
  }
}
