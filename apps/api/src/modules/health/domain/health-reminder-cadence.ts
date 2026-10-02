import { dayKey, localDateIso } from 'src/common/farm-time/farm-time';

/**
 * Health-step reminder cadence (RAKHAL-465, EPIC_HEALTH_CENTER D10, PRD §13.9). Same shape as the subscription
 * renewal cadence (`renewal/domain/renewal-cadence.ts`): a reminder goes out when a step is exactly N calendar days
 * away — 7, 3, 1, and on the day — and, once the day has passed, a daily overdue nag. Pure: no Prisma, no clock —
 * the caller supplies `now` and the farm's timezone so "days away" is counted on the **farm's** calendar day.
 */

export type HealthReminderStage =
  | 'T_MINUS_7'
  | 'T_MINUS_3'
  | 'T_MINUS_1'
  | 'DAY_OF';

export const HEALTH_REMINDER_CADENCE: {
  stage: HealthReminderStage;
  daysUntil: number;
}[] = [
  { stage: 'T_MINUS_7', daysUntil: 7 },
  { stage: 'T_MINUS_3', daysUntil: 3 },
  { stage: 'T_MINUS_1', daysUntil: 1 },
  { stage: 'DAY_OF', daysUntil: 0 },
];

/** An open step older than this is stale data, not a reminder — the nag stops instead of running forever. */
export const OVERDUE_MAX_DAYS = 30;

/**
 * One event per urgency band rather than one event with a stage param: the catalogue fixes priority and default
 * channels per event, and only the close-in reminders (T-1, day-of) and overdue should reach SMS once a provider
 * is wired, while T-7/T-3 stay in-app + push.
 */
export const STAGE_EVENT_KEY: Record<HealthReminderStage, string> = {
  T_MINUS_7: 'health_task_reminder',
  T_MINUS_3: 'health_task_reminder',
  T_MINUS_1: 'health_task_due_tomorrow',
  DAY_OF: 'health_task_due_today',
};

export const OVERDUE_EVENT_KEY = 'health_task_overdue';

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Whole calendar days from today to `due`, both taken as the calendar date in `timezone` (negative once the day has
 * passed). A step due at 23:30 farm time is "today" until midnight there, whatever the UTC clock says.
 */
export function farmDaysUntil(
  due: Date,
  timezone: string,
  now: Date = new Date(),
): number {
  const dueDay = dayKey(localDateIso(timezone, due)).getTime();
  const today = dayKey(localDateIso(timezone, now)).getTime();
  return Math.round((dueDay - today) / DAY_MS);
}

export function stageForDaysUntil(
  daysUntil: number,
): HealthReminderStage | null {
  return (
    HEALTH_REMINDER_CADENCE.find((s) => s.daysUntil === daysUntil)?.stage ??
    null
  );
}

export type ReminderDecision =
  | { kind: 'stage'; stage: HealthReminderStage; daysUntil: number }
  | { kind: 'overdue'; daysOverdue: number };

/**
 * What (if anything) to send today for a step `daysUntil` days away. A stage is sent only when `daysUntil` equals it
 * on the day the sweep runs — a protocol applied two days before its first step never sends T-7/T-3 (no back-fill).
 */
export function reminderFor(daysUntil: number): ReminderDecision | null {
  if (daysUntil < 0) {
    const daysOverdue = -daysUntil;
    return daysOverdue <= OVERDUE_MAX_DAYS
      ? { kind: 'overdue', daysOverdue }
      : null;
  }
  const stage = stageForDaysUntil(daysUntil);
  return stage ? { kind: 'stage', stage, daysUntil } : null;
}
