import { Injectable } from '@nestjs/common';
import {
  HealthCaseStatus,
  HealthTaskStatus,
  HerdStatus,
  PlanEnrollmentStatus,
  Prisma,
} from '@prisma/client';
import { FarmClockService } from 'src/common/farm-time/farm-clock.service';
import { localDateIso } from 'src/common/farm-time/farm-time';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  computePlanStats,
  countStepsByFarmDay,
  NO_SCHEDULE,
  PlanCaseFact,
  PlanEnrollmentFact,
  PlanSchedule,
  PlanStats,
} from '../../domain/health-plan-stats';

const DAY_MS = 24 * 60 * 60 * 1000;
/** Steps due this soon (or already overdue) count as "due". */
const DUE_WINDOW_DAYS = 7;
const OPEN_STEP_STATUSES = [
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

/**
 * Open steps on animals still in the herd whose case is open / enrollment is active — the same "live" rule the
 * health step notices use (`HealthStepSourceResolver`), so the number on a protocol card is the number a notice talks about.
 */
export function liveStepWhere(farmId: string): Prisma.HealthTaskWhereInput {
  return {
    farmId,
    deletedAt: null,
    status: { in: OPEN_STEP_STATUSES },
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
  };
}

/**
 * Protocol results for the Protocols tab (RAKHAL-466, MILESTONE 29 / ADR-029, PRD §13.6). Computed live from the cases
 * and enrollments that actually used each protocol — never stored (the old `successRate` /
 * `currentlyActiveAnimalCount` columns were dead and are gone). One query per source for the whole page of plans, not
 * one per plan. Maths lives in `domain/health-plan-stats.ts`.
 *
 * RAKHAL-470 adds each protocol's schedule — steps due today, steps overdue and the next due day — on the **farm's**
 * calendar day (`Farm.timezone`), not the browser's or the server's.
 */
@Injectable()
export class HealthPlanStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: FarmClockService,
  ) {}

  /** `stats` by plan id for the given plans. */
  async statsFor(
    farmId: string,
    plans: { id: string; category: string }[],
    now: Date = new Date(),
  ): Promise<Map<string, PlanStats>> {
    if (plans.length === 0) return new Map();
    const ids = plans.map((plan) => plan.id);
    const horizon = new Date(now.getTime() + DUE_WINDOW_DAYS * DAY_MS);
    const timezone = await this.clock.timezone(farmId);
    const live = liveStepWhere(farmId);

    const [cases, enrollments, due, closeSteps, nextSteps] = await Promise.all([
      this.prisma.healthCase.findMany({
        where: { farmId, healthPlanId: { in: ids }, deletedAt: null },
        select: { healthPlanId: true, cattleId: true, status: true },
      }),
      this.prisma.planEnrollment.findMany({
        where: { farmId, healthPlanId: { in: ids }, deletedAt: null },
        select: { healthPlanId: true, cattleId: true, status: true },
      }),
      // Open preventive steps of still-active enrollments, due within a week or already late.
      this.prisma.healthTask.groupBy({
        by: ['healthPlanId'],
        where: {
          farmId,
          healthPlanId: { in: ids },
          deletedAt: null,
          planEnrollmentId: { not: null },
          status: { in: OPEN_STEP_STATUSES },
          dueDateTime: { lte: horizon },
          planEnrollment: {
            is: { status: PlanEnrollmentStatus.ACTIVE, deletedAt: null },
          },
        },
        _count: { _all: true },
      }),
      // Every open live step up to the end of tomorrow — enough to split "today" from "overdue" in the farm's day (a
      // timezone shifts the day boundary by up to 14 h, so the cut is made in code, not in SQL).
      this.prisma.healthTask.findMany({
        where: {
          ...live,
          healthPlanId: { in: ids },
          dueDateTime: { lt: new Date(now.getTime() + 2 * DAY_MS) },
        },
        select: { healthPlanId: true, dueDateTime: true },
      }),
      // The earliest open live step of each plan, however far away.
      this.prisma.healthTask.groupBy({
        by: ['healthPlanId'],
        where: { ...live, healthPlanId: { in: ids } },
        _min: { dueDateTime: true },
      }),
    ]);

    const casesByPlan = group<PlanCaseFact>(cases);
    const enrollmentsByPlan = group<PlanEnrollmentFact>(enrollments);
    const dueByPlan = new Map(
      due.map((row) => [row.healthPlanId as string, row._count._all]),
    );
    const closeByPlan = new Map<string, Date[]>();
    for (const step of closeSteps) {
      if (!step.healthPlanId) continue;
      const list = closeByPlan.get(step.healthPlanId);
      if (list) list.push(step.dueDateTime);
      else closeByPlan.set(step.healthPlanId, [step.dueDateTime]);
    }
    const nextByPlan = new Map(
      nextSteps.flatMap((row) =>
        row.healthPlanId && row._min.dueDateTime
          ? [[row.healthPlanId, row._min.dueDateTime] as const]
          : [],
      ),
    );

    return new Map(
      plans.map((plan) => {
        const next = nextByPlan.get(plan.id);
        const schedule: PlanSchedule = next
          ? {
              ...countStepsByFarmDay(
                closeByPlan.get(plan.id) ?? [],
                timezone,
                now,
              ),
              nextDueDate: localDateIso(timezone, next),
            }
          : NO_SCHEDULE;
        return [
          plan.id,
          computePlanStats(
            plan.category,
            casesByPlan.get(plan.id) ?? [],
            enrollmentsByPlan.get(plan.id) ?? [],
            dueByPlan.get(plan.id) ?? 0,
            schedule,
          ),
        ];
      }),
    );
  }

  /** Adds `stats` to every plan in a cursor page (envelope and `meta` untouched). */
  async attach<T extends { id: string; category: string }, M>(
    farmId: string,
    page: { items: T[]; meta: M },
  ) {
    const stats = await this.statsFor(farmId, page.items);
    return {
      ...page,
      items: page.items.map((plan) => ({
        ...plan,
        stats: stats.get(plan.id)!,
      })),
    };
  }
}

function group<T>(
  rows: ({ healthPlanId: string | null } & T)[],
): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    if (!row.healthPlanId) continue;
    const list = map.get(row.healthPlanId);
    if (list) list.push(row);
    else map.set(row.healthPlanId, [row]);
  }
  return map;
}
