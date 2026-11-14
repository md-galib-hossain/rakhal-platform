import { Injectable } from '@nestjs/common';
import {
  BreedingStatus,
  HealthCaseStatus,
  HealthTaskStatus,
  LactationStatus,
  PlanEnrollmentStatus,
  PregnancyStatus,
  Prisma,
  SafetyWithdrawalStatus,
  TaskStatus,
} from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { localDateIso } from 'src/common/farm-time/farm-time';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  farmDayEnd,
  farmDayStart,
} from 'src/modules/health/domain/health-farm-day';
import {
  AnimalUpcomingEvent,
  buildAnimalUpcomingEvents,
  DEFAULT_EVENT_LIMIT,
  DEFAULT_WINDOW_DAYS,
  DUE_WEEK_DAYS,
  DueFilter,
  UpcomingEventCandidate,
} from '../../domain/animal-upcoming-events';

/** A step that can still be acted on. `RESCHEDULED` keeps a live status with a new `dueDateTime`. */
const LIVE_HEALTH_TASK_STATUSES = [
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
const OPEN_TASK_STATUSES = [
  TaskStatus.PENDING,
  TaskStatus.IN_PROGRESS,
  TaskStatus.BLOCKED,
];

export interface UpcomingEventsOptions {
  /** Look-ahead in farm days; overdue items are always included. Default 14. */
  windowDays?: number;
  /** Cap on events returned per animal; `total` still counts them all. Default 10. */
  limit?: number;
  now?: Date;
}

export interface AnimalUpcomingEventsResult {
  /** Ordered, capped at `limit`. */
  events: AnimalUpcomingEvent[];
  /** Everything in the window before the cap. */
  total: number;
}

/**
 * Per-animal upcoming events (RAKHAL-474, MILESTONE 30). Gathers dated items from Health, Reproduction, the Task Hub and
 * safety withdrawals for a whole page of animals with **one read per source** (never per animal), then hands them to the
 * pure `buildAnimalUpcomingEvents`.
 *
 * Farm scoping: `HealthTask`, `SafetyWithdrawal` and `Task` carry `farmId`; `BreedingEvent`, `Pregnancy` and `Lactation`
 * do not, so they are scoped through `cattle: { farmId }`. A cattle id from another farm therefore yields nothing.
 *
 * Not emitted yet: `WEANING` (the date is computed in the calf module, not stored).
 */
@Injectable()
export class AnimalUpcomingEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: FarmClockService,
  ) {}

  async forCattle(
    farmId: string,
    cattleIds: string[],
    options: UpcomingEventsOptions = {},
  ): Promise<Map<string, AnimalUpcomingEventsResult>> {
    const result = new Map<string, AnimalUpcomingEventsResult>();
    const ids = [...new Set(cattleIds)];
    for (const id of ids) result.set(id, { events: [], total: 0 });
    if (ids.length === 0) return result;

    const now = options.now ?? new Date();
    const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;
    const limit = options.limit ?? DEFAULT_EVENT_LIMIT;
    const timezone = await this.clock.timezone(farmId);
    const windowEnd = windowEndFor(now, timezone, windowDays);

    const [tasks, breedings, pregnancies, lactations, withdrawals, hubTasks] =
      await Promise.all([
        this.prisma.healthTask.findMany({
          where: {
            farmId,
            cattleId: { in: ids },
            deletedAt: null,
            status: { in: LIVE_HEALTH_TASK_STATUSES },
            dueDateTime: { lt: windowEnd },
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
          },
          select: {
            id: true,
            cattleId: true,
            title: true,
            dueDateTime: true,
            planEnrollmentId: true,
          },
        }),
        // Latest breeding per animal only: an older PENDING_CHECK row behind a newer outcome is not a live wait.
        // A voided breeding (recorded by mistake) is not an attempt at all, so it must not shadow the real latest one.
        this.prisma.breedingEvent.findMany({
          where: {
            cattleId: { in: ids },
            cattle: { farmId },
            voidedAt: null,
          },
          orderBy: [{ breedingDate: 'desc' }, { id: 'desc' }],
          distinct: ['cattleId'],
          select: {
            id: true,
            cattleId: true,
            status: true,
            expectedPregnancyCheckDate: true,
          },
        }),
        this.prisma.pregnancy.findMany({
          where: {
            cattleId: { in: ids },
            cattle: { farmId },
            status: PregnancyStatus.ACTIVE,
            expectedCalvingDate: { not: null, lt: windowEnd },
          },
          select: { id: true, cattleId: true, expectedCalvingDate: true },
        }),
        this.prisma.lactation.findMany({
          where: {
            cattleId: { in: ids },
            cattle: { farmId },
            status: LactationStatus.ACTIVE,
            OR: [
              { plannedDryOffAt: { not: null } },
              { recommendedDryOffAt: { not: null } },
            ],
          },
          select: {
            id: true,
            cattleId: true,
            plannedDryOffAt: true,
            recommendedDryOffAt: true,
          },
        }),
        this.prisma.safetyWithdrawal.findMany({
          where: {
            farmId,
            cattleId: { in: ids },
            status: SafetyWithdrawalStatus.ACTIVE,
          },
          select: {
            id: true,
            cattleId: true,
            milkWithdrawalUntil: true,
            meatWithdrawalUntil: true,
          },
        }),
        this.prisma.task.findMany({
          where: {
            farmId,
            status: { in: OPEN_TASK_STATUSES },
            dueAt: { lt: windowEnd },
            OR: [
              { relatedCattleId: { in: ids } },
              { cattles: { some: { cattleId: { in: ids } } } },
            ],
          },
          select: {
            id: true,
            name: true,
            dueAt: true,
            relatedCattleId: true,
            sourceEventType: true,
            sourceEventId: true,
            cattles: { select: { cattleId: true } },
          },
        }),
      ]);

    const byCattle = new Map<string, UpcomingEventCandidate[]>();
    const push = (cattleId: string, candidate: UpcomingEventCandidate) => {
      const list = byCattle.get(cattleId);
      if (list) list.push(candidate);
      else byCattle.set(cattleId, [candidate]);
    };

    for (const t of tasks) {
      const preventive = t.planEnrollmentId !== null;
      push(t.cattleId, {
        kind: preventive ? 'PREVENTIVE_STEP' : 'HEALTH_STEP',
        labelKey: preventive
          ? 'cattle.upcoming.preventiveStep'
          : 'cattle.upcoming.healthStep',
        labelParams: { title: t.title },
        dueAt: t.dueDateTime,
        actionable: true,
        ref: { type: 'HEALTH_TASK', id: t.id },
      });
    }

    for (const b of breedings) {
      if (
        b.status !== BreedingStatus.PENDING_CHECK ||
        !b.expectedPregnancyCheckDate
      ) {
        continue;
      }
      push(b.cattleId, {
        kind: 'PREGNANCY_CHECK',
        labelKey: 'cattle.upcoming.pregnancyCheck',
        dueAt: b.expectedPregnancyCheckDate,
        actionable: true,
        ref: { type: 'BREEDING_EVENT', id: b.id },
        coversSourceKeys: [`BREEDING_EVENT:${b.id}`],
      });
    }

    for (const p of pregnancies) {
      if (!p.expectedCalvingDate) continue;
      push(p.cattleId, {
        kind: 'CALVING',
        labelKey: 'cattle.upcoming.calving',
        dueAt: p.expectedCalvingDate,
        actionable: true,
        ref: { type: 'PREGNANCY', id: p.id },
      });
    }

    for (const l of lactations) {
      // The farmer's own target wins over the system's pregnancy-driven recommendation.
      const dryOff = l.plannedDryOffAt ?? l.recommendedDryOffAt;
      if (!dryOff) continue;
      push(l.cattleId, {
        kind: 'DRY_OFF',
        labelKey: 'cattle.upcoming.dryOff',
        dueAt: dryOff,
        actionable: true,
        ref: { type: 'LACTATION', id: l.id },
      });
    }

    for (const w of withdrawals) {
      if (w.milkWithdrawalUntil) {
        push(w.cattleId, {
          kind: 'WITHDRAWAL_END',
          labelKey: 'cattle.upcoming.milkWithdrawalEnd',
          dueAt: w.milkWithdrawalUntil,
          actionable: false,
          ref: { type: 'SAFETY_WITHDRAWAL', id: w.id },
        });
      }
      if (w.meatWithdrawalUntil) {
        push(w.cattleId, {
          kind: 'WITHDRAWAL_END',
          labelKey: 'cattle.upcoming.meatWithdrawalEnd',
          dueAt: w.meatWithdrawalUntil,
          actionable: false,
          ref: { type: 'SAFETY_WITHDRAWAL', id: w.id },
        });
      }
    }

    const wanted = new Set(ids);
    for (const t of hubTasks) {
      const targets = new Set<string>();
      if (t.relatedCattleId) targets.add(t.relatedCattleId);
      for (const c of t.cattles) targets.add(c.cattleId);
      for (const cattleId of targets) {
        if (!wanted.has(cattleId)) continue;
        push(cattleId, {
          kind: 'TASK',
          labelKey: 'cattle.upcoming.task',
          labelParams: { title: t.name },
          dueAt: t.dueAt,
          actionable: true,
          ref: { type: 'TASK', id: t.id },
          ...(t.sourceEventType && t.sourceEventId
            ? { sourceKey: `${t.sourceEventType}:${t.sourceEventId}` }
            : {}),
        });
      }
    }

    for (const [cattleId, candidates] of byCattle) {
      const events = buildAnimalUpcomingEvents(candidates, {
        now,
        timezone,
        windowDays,
      });
      result.set(cattleId, {
        events: events.slice(0, limit),
        total: events.length,
      });
    }
    return result;
  }

  /**
   * `where` for the list's `dueFilter`: animals with an **actionable** event in the range (see `DUE_FILTERS`). The same
   * sources as `forCattle`, as `some` conditions on the indexed relations; the Task Hub has no relation to `Cattle`
   * (`relatedCattleId` / `TaskCattle` are plain scalars), so tasks are resolved to animal ids first.
   *
   * Differs from the column in one corner: a pregnancy check matches on *any* pending breeding, not only the latest.
   * An older breeding left pending behind a newer outcome is a data oddity, not a live wait.
   */
  async dueFilterWhere(
    farmId: string,
    filter: DueFilter,
    now: Date = new Date(),
  ): Promise<Prisma.CattleWhereInput> {
    const timezone = await this.clock.timezone(farmId);
    const today = localDateIso(timezone, now);
    const todayStart = farmDayStart(today, timezone);
    const range: Prisma.DateTimeFilter =
      filter === 'overdue'
        ? { lt: todayStart }
        : filter === 'today'
          ? { gte: todayStart, lt: farmDayEnd(today, timezone) }
          : {
              gte: todayStart,
              lt: farmDayEnd(addDaysYmd(today, DUE_WEEK_DAYS), timezone),
            };

    const hubTasks = await this.prisma.task.findMany({
      where: { farmId, status: { in: OPEN_TASK_STATUSES }, dueAt: range },
      select: {
        relatedCattleId: true,
        cattles: { select: { cattleId: true } },
      },
    });
    const taskCattleIds = new Set<string>();
    for (const t of hubTasks) {
      if (t.relatedCattleId) taskCattleIds.add(t.relatedCattleId);
      for (const c of t.cattles) taskCattleIds.add(c.cattleId);
    }

    const or: Prisma.CattleWhereInput[] = [
      {
        healthTasks: {
          some: {
            deletedAt: null,
            status: { in: LIVE_HEALTH_TASK_STATUSES },
            dueDateTime: range,
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
          },
        },
      },
      {
        breedingEvents: {
          some: {
            status: BreedingStatus.PENDING_CHECK,
            voidedAt: null,
            expectedPregnancyCheckDate: range,
          },
        },
      },
      {
        pregnancies: {
          some: { status: PregnancyStatus.ACTIVE, expectedCalvingDate: range },
        },
      },
      {
        lactations: {
          some: {
            status: LactationStatus.ACTIVE,
            // Same precedence as the event: the farmer's planned date wins over the recommendation.
            OR: [
              { plannedDryOffAt: range },
              { plannedDryOffAt: null, recommendedDryOffAt: range },
            ],
          },
        },
      },
    ];
    if (taskCattleIds.size > 0) {
      or.push({ id: { in: [...taskCattleIds] } });
    }
    return { OR: or };
  }
}

/** Farm calendar date `n` days after the date `ymd` (`YYYY-MM-DD`). */
function addDaysYmd(ymd: string, n: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** Exclusive upper bound: the instant the farm day after `today + windowDays` begins. */
function windowEndFor(now: Date, timezone: string, windowDays: number): Date {
  return farmDayEnd(
    addDaysYmd(localDateIso(timezone, now), windowDays),
    timezone,
  );
}
