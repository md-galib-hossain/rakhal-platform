import { Injectable } from '@nestjs/common';
import {
  HealthCaseStatus,
  HealthTaskStatus,
  HerdStatus,
  PlanEnrollmentStatus,
} from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { dayKey, localDateIso } from 'src/common/farm-time/farm-time';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { NotificationService } from 'src/modules/notification/application/services/notification.service';

const DAY_MS = 24 * 60 * 60 * 1000;
/** A group stops nagging once it is more than this many farm-local days overdue (docs/EPIC_NOTIFICATIONS_V2.md §3.7). */
export const OVERDUE_MAX_DAYS = 30;
const OPEN_TASK_STATUSES = ['PENDING', 'IN_PROGRESS', 'BLOCKED'] as const;
const LIVE_STEP_STATUSES = [
  HealthTaskStatus.PENDING,
  HealthTaskStatus.RESCHEDULED,
  HealthTaskStatus.OVERDUE,
];
const OPEN_CASE_STATUSES = [
  HealthCaseStatus.ACTIVE,
  HealthCaseStatus.IMPROVING,
  HealthCaseStatus.WORSENING,
  HealthCaseStatus.STABLE,
];

interface Group {
  sourceType: 'TASK' | 'HEALTH_STEP';
  /** Same shape as the schedule `sourceKey`: `rule:<ruleKey>:<ymd>`, `round:<id>:<ymd>`, `case:<id>:<ymd>`. */
  groupKey: string;
  label: string;
  cattleIds: Set<string>;
  dueYmd: string;
  daysOverdue: number;
  link: string;
}

type Groups = Map<string, Map<string, Group>>; // farmId -> "<sourceType>|<groupKey>" -> group

/**
 * The daily "still overdue" nag (RAKHAL-498, docs/EPIC_NOTIFICATIONS_V2.md §3.7). State-derived, NOT a schedule: it
 * reads open work whose farm-local due day has passed and sends ONE `scheduled_overdue` per group per day.
 *
 * - Groups: follow-up rule tasks (`ruleKey` set) per `(rule, due day)`, health steps per `(round | case, due day)`.
 *   Never per animal. The group key equals the one the v2 producers use as `sourceKey`.
 * - Capped at {@link OVERDUE_MAX_DAYS} days overdue; the due day itself is "day-of" (a lead-0 occurrence), not overdue.
 * - Plain tasks are NOT nagged here: `task_overdue` owns them (it filters `ruleKey: null`), so the two sweeps are
 *   disjoint by construction and can never notify the same item.
 * - Idempotent: `dedupeKey = ov:<sourceType>:<groupKey>:<todayYmd>`; a re-run on the same farm day sends nothing.
 * - Recipients Owner + Manager. Animals that left the herd are dropped; a group with none left sends nothing.
 *
 * Lives in the scheduler module because it is a sweep, not a producer. Two queries per run over open rows due in the
 * last 32 days; it never wakes the DB outside the 05:00 cron.
 */
@Injectable()
export class OverdueNagService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly farmClock: FarmClockService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(OverdueNagService.name);
  }

  /** Returns the number of notifications created. */
  async sweepAll(now: Date = new Date()): Promise<number> {
    const groups: Groups = new Map();
    await this.collectRuleTasks(now, groups);
    await this.collectHealthSteps(now, groups);

    let sent = 0;
    for (const [farmId, byKey] of groups) {
      try {
        const todayYmd = localDateIso(
          await this.farmClock.timezone(farmId),
          now,
        );
        for (const g of byKey.values()) {
          sent += await this.notify(farmId, g, todayYmd);
        }
      } catch (err) {
        this.log.error('Overdue nag failed for a farm', {
          farmId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
    return sent;
  }

  private async notify(
    farmId: string,
    g: Group,
    todayYmd: string,
  ): Promise<number> {
    const animals = g.cattleIds.size;
    const created = await this.notifications.notifyOwnersAndManagers({
      farmId,
      eventKey: 'scheduled_overdue',
      title: 'Overdue',
      message: `${g.label}: ${animals} animal(s) overdue since ${g.dueYmd}.`,
      params: {
        label: g.label,
        animals,
        date: g.dueYmd,
        days: g.daysOverdue,
      },
      link: g.link,
      dedupeKey: `ov:${g.sourceType}:${g.groupKey}:${todayYmd}`,
    });
    return created.length;
  }

  /** Whole farm-local days from `dueYmd` to `todayYmd` (>= 1 means the due day has fully passed). */
  private daysOverdue(dueYmd: string, todayYmd: string): number {
    return Math.round(
      (dayKey(todayYmd).getTime() - dayKey(dueYmd).getTime()) / DAY_MS,
    );
  }

  private group(groups: Groups, farmId: string, g: Group): Group {
    const byKey = groups.get(farmId) ?? new Map<string, Group>();
    groups.set(farmId, byKey);
    const id = `${g.sourceType}|${g.groupKey}`;
    const existing = byKey.get(id);
    if (existing) return existing;
    byKey.set(id, g);
    return g;
  }

  private async collectRuleTasks(now: Date, groups: Groups): Promise<void> {
    const tasks = await this.prisma.task.findMany({
      where: {
        ruleKey: { not: null },
        status: { in: [...OPEN_TASK_STATUSES] },
        dueAt: {
          gte: new Date(now.getTime() - (OVERDUE_MAX_DAYS + 2) * DAY_MS),
          lt: now,
        },
      },
      select: {
        farmId: true,
        ruleKey: true,
        name: true,
        dueAt: true,
        relatedCattleId: true,
        cattles: { select: { cattleId: true } },
      },
    });
    if (tasks.length === 0) return;

    const idsOf = (t: (typeof tasks)[number]): string[] => [
      ...new Set([
        ...(t.relatedCattleId ? [t.relatedCattleId] : []),
        ...t.cattles.map((c) => c.cattleId),
      ]),
    ];
    const allIds = [...new Set(tasks.flatMap(idsOf))];
    const live = new Set(
      allIds.length
        ? (
            await this.prisma.cattle.findMany({
              where: {
                id: { in: allIds },
                herdStatus: HerdStatus.ACTIVE,
                deletedAt: null,
              },
              select: { id: true },
            })
          ).map((c) => c.id)
        : [],
    );

    const tzByFarm = new Map<string, string>();
    for (const t of tasks) {
      let tz = tzByFarm.get(t.farmId);
      if (!tz) {
        tz = await this.farmClock.timezone(t.farmId);
        tzByFarm.set(t.farmId, tz);
      }
      const ids = idsOf(t);
      // An animal-bound task whose animals all left the herd has nothing to say.
      if (ids.length > 0 && !ids.some((id) => live.has(id))) continue;
      const dueYmd = localDateIso(tz, t.dueAt);
      const days = this.daysOverdue(dueYmd, localDateIso(tz, now));
      if (days < 1 || days > OVERDUE_MAX_DAYS) continue;
      const g = this.group(groups, t.farmId, {
        sourceType: 'TASK',
        groupKey: `rule:${t.ruleKey}:${dueYmd}`,
        label: t.name,
        cattleIds: new Set(),
        dueYmd,
        daysOverdue: days,
        link: `/animals?due=${t.ruleKey}`,
      });
      for (const id of ids) if (live.has(id)) g.cattleIds.add(id);
    }
  }

  private async collectHealthSteps(now: Date, groups: Groups): Promise<void> {
    const steps = await this.prisma.healthTask.findMany({
      where: {
        deletedAt: null,
        status: { in: LIVE_STEP_STATUSES },
        dueDateTime: {
          gte: new Date(now.getTime() - (OVERDUE_MAX_DAYS + 2) * DAY_MS),
          lt: now,
        },
        cattle: { herdStatus: HerdStatus.ACTIVE, deletedAt: null },
        OR: [
          {
            healthCase: {
              is: { status: { in: OPEN_CASE_STATUSES }, deletedAt: null },
            },
          },
          {
            planEnrollment: {
              is: { status: PlanEnrollmentStatus.ACTIVE, deletedAt: null },
            },
          },
        ],
      },
      select: {
        farmId: true,
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
      },
    });

    const tzByFarm = new Map<string, string>();
    for (const s of steps) {
      let tz = tzByFarm.get(s.farmId);
      if (!tz) {
        tz = await this.farmClock.timezone(s.farmId);
        tzByFarm.set(s.farmId, tz);
      }
      const dueYmd = localDateIso(tz, s.dueDateTime);
      const days = this.daysOverdue(dueYmd, localDateIso(tz, now));
      if (days < 1 || days > OVERDUE_MAX_DAYS) continue;
      const round = s.planEnrollment?.planApplicationId;
      const kindId = round
        ? `round:${round}`
        : s.healthCaseId
          ? `case:${s.healthCaseId}`
          : null;
      if (!kindId) continue;
      const planName =
        s.planEnrollment?.healthPlan.name ??
        s.healthCase?.healthPlan?.name ??
        s.healthPlan?.name ??
        s.title;
      const g = this.group(groups, s.farmId, {
        sourceType: 'HEALTH_STEP',
        groupKey: `${kindId}:${dueYmd}`,
        // Curative groups name the animal, preventive rounds the protocol (same as the due-soon copy).
        label: round
          ? planName
          : `${planName} · ${s.cattle.name ?? s.cattle.tagNumber}`,
        cattleIds: new Set(),
        dueYmd,
        daysOverdue: days,
        link: '/healthcare?healthTab=protocols&bucket=overdue',
      });
      g.cattleIds.add(s.cattleId);
    }
  }
}
