/**
 * RAKHAL-485: when a follow-up task or a custom reminder notifies, on the farm's calendar day.
 * Pure: the caller supplies `daysUntil` (see `farmDaysUntil`). No back-fill: a lead notice goes
 * out only on the day `daysUntil` equals it, so a task made one day before its due date never
 * sends the earlier notices.
 */
export type ReminderStage = 'UPCOMING' | 'DUE_TODAY' | 'OVERDUE';

/** Follow-up rules already carry their lead in the offset, so only a day-before notice is added. */
export const FOLLOW_UP_LEAD_DAYS = 1;

/** An open task older than this is stale data, not a reminder: the nag stops. */
export const REMINDER_OVERDUE_MAX_DAYS = 30;

export const STAGE_EVENT_KEY: Record<ReminderStage, string> = {
  UPCOMING: 'follow_up_upcoming',
  DUE_TODAY: 'follow_up_due_today',
  OVERDUE: 'follow_up_overdue',
};

export type ReminderDecision =
  | { stage: 'UPCOMING'; daysUntil: number }
  | { stage: 'DUE_TODAY'; daysUntil: 0 }
  | { stage: 'OVERDUE'; daysOverdue: number };

/**
 * What to send today for an item `daysUntil` days away, or null for nothing.
 * `leadDays` is the lead notice (T-n); null or 0 means none besides the day itself.
 */
export function decideReminder(
  daysUntil: number,
  leadDays: number | null,
): ReminderDecision | null {
  if (daysUntil < 0) {
    const daysOverdue = -daysUntil;
    return daysOverdue <= REMINDER_OVERDUE_MAX_DAYS
      ? { stage: 'OVERDUE', daysOverdue }
      : null;
  }
  if (daysUntil === 0) return { stage: 'DUE_TODAY', daysUntil: 0 };
  if (leadDays && leadDays > 0 && daysUntil === leadDays) {
    return { stage: 'UPCOMING', daysUntil };
  }
  return null;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** The next due date of a repeating reminder: the interval after `from`. */
export function nextOccurrence(
  from: Date,
  type: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'EVERY_N_DAYS',
  intervalDays?: number | null,
): Date {
  if (type === 'DAILY') return new Date(from.getTime() + DAY_MS);
  if (type === 'WEEKLY') return new Date(from.getTime() + 7 * DAY_MS);
  if (type === 'EVERY_N_DAYS') {
    return new Date(from.getTime() + Math.max(1, intervalDays ?? 1) * DAY_MS);
  }
  const next = new Date(from);
  next.setMonth(next.getMonth() + 1);
  return next;
}
