import { Injectable } from '@nestjs/common';
import { HealthCareType, HealthCaseStatus } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  aggregateOutcomes,
  CaseTimeline,
  dayOfIllness,
  elapsedDays,
  findPreviousSameCondition,
  OutcomeCase,
  RECURRENCE_WINDOW_DAYS,
} from '../../domain/health-case-outcome';
import { buildTrend } from '../../domain/morbidity-trend';

const DAY_MS = 24 * 60 * 60 * 1000;
const CLOSED_STATUSES: HealthCaseStatus[] = [
  HealthCaseStatus.RECOVERED,
  HealthCaseStatus.MORTALITY,
  HealthCaseStatus.CLOSED,
];

/** What `caseSummary` needs from a case row that `getHealthCase` already loaded — no second fetch. */
export interface CaseSummaryInput {
  id: string;
  cattleId: string;
  condition: string | null;
  status: HealthCaseStatus;
  startDate: Date;
  closedDate: Date | null;
  currentStep: number;
  totalSteps: number;
  healthPlan: { id: string; name: string } | null;
  treatmentLogs: { financeTransactionId: string | null }[];
}

/**
 * Case results and farm outcomes (RAKHAL-467, MILESTONE 29 / ADR-029, PRD §13.9). "What was the sickness, what did we
 * do, what was the result" — all derived from facts the case already holds, no new schema:
 *  - **Cost** is the sum of the non-voided `Expense` rows the case's treatments posted (RAKHAL-419 stores the id on
 *    `TreatmentLog.financeTransactionId`; the amount lives on the expense, and a voided expense no longer counts).
 *    Looked up by id, not joined — `health/**` keeps no relation to `purchasing/**`'s tables (ADR-016).
 *  - **Recurrence**: same animal + same structured condition, previous case closed ≤ 60 days before this one started.
 * Pure maths lives in `domain/health-case-outcome.ts`; this class only fetches.
 */
@Injectable()
export class HealthOutcomesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Summary shown on a case: day count, steps, protocol, treatments, cost, outcome and recurrence. */
  async caseSummary(
    farmId: string,
    healthCase: CaseSummaryInput,
    now: Date = new Date(),
  ) {
    const closed = healthCase.closedDate;
    const expenseIds = healthCase.treatmentLogs
      .map((log) => log.financeTransactionId)
      .filter((id): id is string => Boolean(id));
    const [amountById, previous] = await Promise.all([
      this.expenseAmounts(farmId, expenseIds),
      this.previousSameCondition(farmId, healthCase),
    ]);
    const totalCost = expenseIds.reduce(
      (sum, id) => sum + (amountById.get(id) ?? 0),
      0,
    );

    return {
      /** Elapsed days — through today while open, to the close date once closed. */
      daysSick: closed
        ? elapsedDays(healthCase.startDate, closed)
        : dayOfIllness(healthCase.startDate, now),
      daysToRecover:
        healthCase.status === HealthCaseStatus.RECOVERED && closed
          ? elapsedDays(healthCase.startDate, closed)
          : null,
      outcome: CLOSED_STATUSES.includes(healthCase.status)
        ? healthCase.status
        : null,
      treatmentCount: healthCase.treatmentLogs.length,
      stepsDone: healthCase.currentStep,
      stepsTotal: healthCase.totalSteps,
      protocol: healthCase.healthPlan,
      totalCost: Math.round(totalCost * 100) / 100,
      recurrence: previous
        ? {
            isRecurrence: true,
            previousCaseId: previous.id,
            previousClosedDate: previous.closedDate,
            daysSincePrevious: Math.max(
              0,
              Math.floor(
                (healthCase.startDate.getTime() -
                  previous.closedDate.getTime()) /
                  DAY_MS,
              ),
            ),
          }
        : {
            isRecurrence: false,
            previousCaseId: null,
            previousClosedDate: null,
            daysSincePrevious: null,
          },
    };
  }

  /**
   * Farm results for the curative cases **opened** in the last `days` days: counts, recovery rate, average days to
   * recover, average cost per case, recurrence rate, and the same per condition. Preventive backing cases
   * (`careType: PREVENTIVE`) are not sickness and stay out.
   */
  async getOutcomes(farmId: string, days: number, now: Date = new Date()) {
    const since = new Date(now.getTime() - days * DAY_MS);
    const historyFrom = new Date(
      since.getTime() - RECURRENCE_WINDOW_DAYS * DAY_MS,
    );

    const rows = await this.prisma.healthCase.findMany({
      where: {
        farmId,
        deletedAt: null,
        careType: HealthCareType.CURATIVE,
        OR: [
          { startDate: { gte: since } },
          { closedDate: { gte: historyFrom } },
        ],
      },
      select: {
        id: true,
        cattleId: true,
        condition: true,
        status: true,
        startDate: true,
        closedDate: true,
      },
    });
    const cohort = rows.filter((row) => row.startDate >= since);
    const history: CaseTimeline[] = rows.filter((row) => row.closedDate);

    const logs = cohort.length
      ? await this.prisma.treatmentLog.findMany({
          where: {
            farmId,
            healthCaseId: { in: cohort.map((row) => row.id) },
            financeTransactionId: { not: null },
            voidedAt: null,
          },
          select: { healthCaseId: true, financeTransactionId: true },
        })
      : [];
    const amountById = await this.expenseAmounts(
      farmId,
      logs.map((log) => log.financeTransactionId as string),
    );
    const costByCase = new Map<string, number>();
    for (const log of logs) {
      costByCase.set(
        log.healthCaseId,
        (costByCase.get(log.healthCaseId) ?? 0) +
          (amountById.get(log.financeTransactionId as string) ?? 0),
      );
    }

    const cases: OutcomeCase[] = cohort.map((row) => ({
      condition: row.condition,
      status: row.status,
      startDate: row.startDate,
      closedDate: row.closedDate,
      cost: costByCase.get(row.id) ?? 0,
      isRecurrence: findPreviousSameCondition(row, history) !== null,
    }));

    return { windowDays: days, since, ...aggregateOutcomes(cases) };
  }

  /**
   * Sickness trend for the Insights chart: curative cases opened per day / week / month, zero-filled, over the last
   * `days` days — or since the first case ever when `days` is omitted ("all time"). `previousTotal` is the same-length
   * window right before, so the chart can say whether sickness is rising or falling; `null` for all time.
   */
  async getMorbidityTrend(
    farmId: string,
    days: number | undefined,
    now: Date = new Date(),
  ) {
    const today = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );
    const where = {
      farmId,
      deletedAt: null,
      careType: HealthCareType.CURATIVE,
    };

    if (days === undefined) {
      const rows = await this.prisma.healthCase.findMany({
        where,
        orderBy: { startDate: 'asc' },
        select: { startDate: true },
      });
      if (rows.length === 0) {
        return {
          windowDays: null,
          bucket: 'month' as const,
          total: 0,
          previousTotal: null,
          points: [],
        };
      }
      return {
        windowDays: null,
        ...buildTrend(
          rows.map((row) => row.startDate),
          rows[0].startDate,
          today,
        ),
        total: rows.length,
        previousTotal: null,
      };
    }

    const from = new Date(today.getTime() - (days - 1) * DAY_MS);
    const previousFrom = new Date(from.getTime() - days * DAY_MS);
    const [rows, previousTotal] = await Promise.all([
      this.prisma.healthCase.findMany({
        where: { ...where, startDate: { gte: from } },
        select: { startDate: true },
      }),
      this.prisma.healthCase.count({
        where: { ...where, startDate: { gte: previousFrom, lt: from } },
      }),
    ]);
    return {
      windowDays: days,
      ...buildTrend(
        rows.map((row) => row.startDate),
        from,
        today,
      ),
      total: rows.length,
      previousTotal,
    };
  }

  /** The closed same-condition case that makes `healthCase` a recurrence, if any. */
  private async previousSameCondition(
    farmId: string,
    healthCase: CaseSummaryInput,
  ): Promise<{ id: string; closedDate: Date } | null> {
    if (!healthCase.condition) return null;
    const earliest = new Date(
      healthCase.startDate.getTime() - RECURRENCE_WINDOW_DAYS * DAY_MS,
    );
    const candidates = await this.prisma.healthCase.findMany({
      where: {
        farmId,
        cattleId: healthCase.cattleId,
        id: { not: healthCase.id },
        deletedAt: null,
        condition: healthCase.condition as never,
        closedDate: { gte: earliest, lte: healthCase.startDate },
      },
      select: {
        id: true,
        cattleId: true,
        condition: true,
        startDate: true,
        closedDate: true,
      },
    });
    const found = findPreviousSameCondition(healthCase, candidates);
    return found
      ? { id: found.id, closedDate: found.closedDate as Date }
      : null;
  }

  /** `Expense.amount` by id, skipping voided expenses. */
  private async expenseAmounts(
    farmId: string,
    ids: string[],
  ): Promise<Map<string, number>> {
    if (ids.length === 0) return new Map();
    const expenses = await this.prisma.expense.findMany({
      where: { farmId, id: { in: [...new Set(ids)] }, voidedAt: null },
      select: { id: true, amount: true },
    });
    return new Map(expenses.map((e) => [e.id, Number(e.amount)]));
  }
}
