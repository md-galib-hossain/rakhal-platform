import { toMoney, type Money } from 'src/common/money';
import type { ReportPeriod } from '../../../domain/contracts/period';
import type { ReportDb } from '../metric-context';
import {
  ACTIVE_WITHDRAWAL_STATUSES,
  LIVE_TASK_STATUSES,
  type CaseRow,
  type TaskRow,
  type TreatmentRow,
  type WithdrawalRow,
  type Window,
} from './health-aggregation';

const DAY_MS = 24 * 60 * 60 * 1000;

export const toWindow = (p: ReportPeriod): Window => ({
  start: new Date(p.start),
  end: new Date(p.end),
});

interface Scope {
  db: ReportDb;
  farmId: string;
  cattleIds: readonly string[];
}

/** Curative cases that could matter for [start, end): started before end and not closed before start. */
export async function fetchCases(s: Scope, w: Window): Promise<CaseRow[]> {
  return s.db.healthCase.findMany({
    where: {
      farmId: s.farmId,
      cattleId: { in: [...s.cattleIds] },
      deletedAt: null,
      careType: 'CURATIVE',
      startDate: { lt: w.end },
      OR: [{ closedDate: null }, { closedDate: { gte: w.start } }],
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
}

/** Earlier closed same-cow cases with a condition that could precede a case opened in the window. */
export async function fetchRepeatCandidates(
  s: Scope,
  w: Window,
  cattleIds: readonly string[],
  windowDays: number,
): Promise<CaseRow[]> {
  if (cattleIds.length === 0) return [];
  return s.db.healthCase.findMany({
    where: {
      farmId: s.farmId,
      cattleId: { in: [...cattleIds] },
      deletedAt: null,
      careType: 'CURATIVE',
      condition: { not: null },
      closedDate: {
        gte: new Date(w.start.getTime() - windowDays * DAY_MS),
        lt: w.end,
      },
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
}

export async function fetchTreatments(
  s: Scope,
  w: Window,
): Promise<TreatmentRow[]> {
  return s.db.treatmentLog.findMany({
    where: {
      farmId: s.farmId,
      cattleId: { in: [...s.cattleIds] },
      voidedAt: null,
      administeredAt: { gte: w.start, lt: w.end },
      healthCase: { deletedAt: null },
    },
    select: {
      id: true,
      cattleId: true,
      financeTransactionId: true,
      vetCost: true,
      vetExpenseId: true,
    },
  });
}

/** Amounts of NON-voided expenses only; voided or unknown ids are simply absent. */
export async function fetchExpenseAmounts(
  s: Scope,
  ids: readonly string[],
): Promise<Map<string, Money>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const rows = await s.db.expense.findMany({
    where: { farmId: s.farmId, id: { in: unique }, voidedAt: null },
    select: { id: true, amount: true },
  });
  return new Map(rows.map((e) => [e.id, toMoney(e.amount)]));
}

/** Overdue candidates (derived at `now`) plus preventive completed/missed rows for the window. */
export async function fetchTasks(
  s: Scope,
  w: Window,
  now: Date | null,
): Promise<TaskRow[]> {
  return s.db.healthTask.findMany({
    where: {
      farmId: s.farmId,
      cattleId: { in: [...s.cattleIds] },
      deletedAt: null,
      OR: [
        ...(now
          ? [
              {
                status: { in: [...LIVE_TASK_STATUSES] as never },
                dueDateTime: { lt: now },
              },
            ]
          : []),
        {
          planEnrollmentId: { not: null },
          status: 'COMPLETED',
          completedAt: { gte: w.start, lt: w.end },
        },
        {
          planEnrollmentId: { not: null },
          status: 'MISSED',
          dueDateTime: { gte: w.start, lt: w.end },
        },
      ],
    },
    select: {
      id: true,
      cattleId: true,
      planEnrollmentId: true,
      status: true,
      dueDateTime: true,
      completedAt: true,
    },
  });
}

export async function fetchActiveWithdrawals(
  s: Scope,
): Promise<WithdrawalRow[]> {
  return s.db.safetyWithdrawal.findMany({
    where: {
      farmId: s.farmId,
      cattleId: { in: [...s.cattleIds] },
      status: { in: [...ACTIVE_WITHDRAWAL_STATUSES] as never },
      healthCase: { deletedAt: null },
    },
    select: { id: true, cattleId: true, status: true },
  });
}
