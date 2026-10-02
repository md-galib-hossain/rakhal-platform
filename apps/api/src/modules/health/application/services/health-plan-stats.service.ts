import { Injectable } from '@nestjs/common';
import { HealthTaskStatus, PlanEnrollmentStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  computePlanStats,
  PlanCaseFact,
  PlanEnrollmentFact,
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

/**
 * Protocol results for the Protocols tab (RAKHAL-466, MILESTONE 29 / ADR-029, PRD §13.6). Computed live from the cases
 * and enrollments that actually used each protocol — never stored (the old `successRate` /
 * `currentlyActiveAnimalCount` columns were dead and are gone). One query per source for the whole page of plans, not
 * one per plan. Maths lives in `domain/health-plan-stats.ts`.
 */
@Injectable()
export class HealthPlanStatsService {
  constructor(private readonly prisma: PrismaService) {}

  /** `stats` by plan id for the given plans. */
  async statsFor(
    farmId: string,
    plans: { id: string; category: string }[],
    now: Date = new Date(),
  ): Promise<Map<string, PlanStats>> {
    if (plans.length === 0) return new Map();
    const ids = plans.map((plan) => plan.id);
    const horizon = new Date(now.getTime() + DUE_WINDOW_DAYS * DAY_MS);

    const [cases, enrollments, due] = await Promise.all([
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
    ]);

    const casesByPlan = group<PlanCaseFact>(cases);
    const enrollmentsByPlan = group<PlanEnrollmentFact>(enrollments);
    const dueByPlan = new Map(
      due.map((row) => [row.healthPlanId as string, row._count._all]),
    );

    return new Map(
      plans.map((plan) => [
        plan.id,
        computePlanStats(
          plan.category,
          casesByPlan.get(plan.id) ?? [],
          enrollmentsByPlan.get(plan.id) ?? [],
          dueByPlan.get(plan.id) ?? 0,
        ),
      ]),
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
