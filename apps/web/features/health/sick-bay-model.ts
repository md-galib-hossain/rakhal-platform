import { daysFromToday } from "./task-grouping";
import type { SafetyWithdrawalListItem } from "./types";

/** Pure helpers for the reshaped Sick Bay (RFE-134, EPIC_HEALTH_CENTER D11). No React. */

/** Days until the animal's milk and meat are both safe again — the *longer* of the two, since that is when it is fully
 * clear. `null` when the withdrawal carries neither date. Never negative: a withdrawal waiting to be released reads 0. */
export function withdrawalDaysLeft(w: Pick<SafetyWithdrawalListItem, "milkDaysRemaining" | "meatDaysRemaining">): number | null {
  const values = [w.milkDaysRemaining, w.meatDaysRemaining].filter((v): v is number => typeof v === "number");
  return values.length ? Math.max(0, ...values) : null;
}

type WithdrawalLike = Pick<SafetyWithdrawalListItem, "healthCaseId" | "cattleId" | "milkDaysRemaining" | "meatDaysRemaining">;

/** Days left per health case (the longest, if a case has several withdrawals) — what a Sick Bay row shows. Cases whose
 * withdrawals carry no dates are left out. */
export function withdrawalDaysByCase(items: WithdrawalLike[]): Map<string, number> {
  const byCase = new Map<string, number>();
  for (const item of items) {
    const days = withdrawalDaysLeft(item);
    if (days == null) continue;
    byCase.set(item.healthCaseId, Math.max(byCase.get(item.healthCaseId) ?? 0, days));
  }
  return byCase;
}

/** Which day of the illness it is; the report day is day 1. */
export function dayOfIllness(startDate: string, now: Date = new Date()): number {
  return Math.max(1, -daysFromToday(startDate, now) + 1);
}

export type NextStepTone = "overdue" | "today" | "upcoming";

/** How a case's next step relates to today, so the Sick Bay cell can word it ("2 days overdue") and colour it. */
export function nextStepStatus(dueDateTime: string, now: Date = new Date()): { days: number; tone: NextStepTone } {
  const days = daysFromToday(dueDateTime, now);
  return { days, tone: days < 0 ? "overdue" : days === 0 ? "today" : "upcoming" };
}
