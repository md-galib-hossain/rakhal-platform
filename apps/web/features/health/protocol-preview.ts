import { daysFromToday, noticeDaysFor, reminderSchedule, type ReminderSlot } from "./task-grouping";
import type { HealthCondition, HealthPlanKind, HealthPlanListItem, HealthPlanStep } from "./types";

/** Pure helpers for the Protocols tab (RFE-136, EPIC_HEALTH_CENTER D8/D9): what applying a protocol will actually
 * schedule, before the user commits to it, and which protocols to suggest for a case. No React, no fetching. */

/** Calendar day of a step. Mirrors the backend (`health.service.ts`): step N is due `N - 1` days after the start, so
 * day 1 is the start date itself. `startIso` is a local `YYYY-MM-DD`. */
export function stepDate(startIso: string, dayNumber: number): Date {
  const [y, m, d] = startIso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, (d || 1) + Math.max(0, dayNumber - 1));
}

export interface PreviewRow {
  step: HealthPlanStep;
  date: Date;
  /** Whole days from today; negative when the start date is in the past. */
  daysFromToday: number;
}

export interface WithdrawalPreview {
  /** Last day the milk is withheld, from the step that ends latest; `null` when no step has a milk withdrawal. */
  milkUntil: Date | null;
  meatUntil: Date | null;
}

export interface ProtocolPreview {
  rows: PreviewRow[];
  firstDate: Date | null;
  lastDate: Date | null;
  /** Calendar span first→last step, inclusive. */
  totalDays: number;
  withdrawal: WithdrawalPreview;
  /** The four reminder days of the *first* step — the one the user is about to be reminded of. */
  firstStepReminders: ReminderSlot[];
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function latest(dates: Date[]): Date | null {
  return dates.length ? new Date(Math.max(...dates.map((d) => d.getTime()))) : null;
}

/** What starting `steps` on `startIso` will create: a dated row per step (earliest first), the span, when milk / meat
 * is safe again, and when the first step's reminders go out. A withdrawal runs for N days after the step that gives the
 * medicine, so `until = step date + N`. */
export function buildProtocolPreview(steps: HealthPlanStep[], startIso: string, now: Date = new Date(), kind?: HealthPlanKind): ProtocolPreview {
  const rows = [...steps]
    .sort((a, b) => a.dayNumber - b.dayNumber)
    .map((step) => {
      const date = stepDate(startIso, step.dayNumber);
      return { step, date, daysFromToday: daysFromToday(date.toISOString(), now) };
    });
  const firstDate = rows[0]?.date ?? null;
  const lastDate = rows[rows.length - 1]?.date ?? null;

  const ends = (pick: (s: HealthPlanStep) => number | null) =>
    latest(rows.filter((r) => (pick(r.step) ?? 0) > 0).map((r) => addDays(r.date, pick(r.step) as number)));

  return {
    rows,
    firstDate,
    lastDate,
    totalDays: firstDate && lastDate ? Math.round((lastDate.getTime() - firstDate.getTime()) / 86_400_000) + 1 : 0,
    withdrawal: { milkUntil: ends((s) => s.milkWithdrawalDays), meatUntil: ends((s) => s.meatWithdrawalDays) },
    firstStepReminders: firstDate ? reminderSchedule(firstDate.toISOString(), now, noticeDaysFor(kind)) : [],
  };
}

export interface SuggestedProtocol {
  plan: HealthPlanListItem;
  /** The protocol is tagged with the case's condition. */
  matches: boolean;
}

/** Order protocols for a case: those tagged with its condition first (EPIC D9 — "matching first, then the rest"; the API
 * only filters, it never ranks). Stable inside each group; with no condition nothing is flagged as a match. */
export function suggestProtocols(plans: HealthPlanListItem[], condition: HealthCondition | null | undefined): SuggestedProtocol[] {
  const tagged = plans.map((plan) => ({ plan, matches: Boolean(condition) && plan.condition === condition }));
  return [...tagged.filter((p) => p.matches), ...tagged.filter((p) => !p.matches)];
}
