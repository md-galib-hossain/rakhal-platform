import { dayKey, localDateIso } from 'src/common/farm-time/farm-time';

/**
 * Upcoming events for one animal (RAKHAL-474, MILESTONE 30 — `docs/EPIC_ANIMAL_UPCOMING_EVENTS.md`). Pure: the service
 * gathers dated candidates from Health / Reproduction / Task Hub; this file decides which are shown, how urgent they are
 * and in what order. No framework, no Prisma.
 *
 * "Today" / "overdue" are questions about the farm's own calendar day, so every day comparison goes through
 * `localDateIso(timezone, …)` — same rule as the health reminders, so the column and the bell never disagree.
 */

export type AnimalEventKind =
  | 'HEALTH_STEP'
  | 'PREVENTIVE_STEP'
  | 'PREGNANCY_CHECK'
  | 'CALVING'
  | 'DRY_OFF'
  | 'TASK'
  | 'WITHDRAWAL_END'
  /** Reserved: the weaning date is computed in the calf module, not stored; not emitted yet. */
  | 'WEANING';

export type AnimalEventUrgency = 'OVERDUE' | 'DUE_SOON' | 'LATER';

/**
 * List filter over the same events (actionable ones only; a withdrawal ending is information, not work):
 * `overdue` = before today, `today` = the farm's current day, `week` = today through the next 7 days.
 */
export const DUE_FILTERS = ['overdue', 'today', 'week'] as const;
export type DueFilter = (typeof DUE_FILTERS)[number];
/** `week` covers today plus this many further farm days. */
export const DUE_WEEK_DAYS = 7;

/** Days ahead (inclusive) that read as "due soon". */
export const DUE_SOON_DAYS = 3;
/** Default look-ahead; overdue items are always kept regardless. */
export const DEFAULT_WINDOW_DAYS = 14;
/** Per-animal cap on the returned list. */
export const DEFAULT_EVENT_LIMIT = 10;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Tie-break when two events share a day: lower index wins. */
const KIND_PRIORITY: AnimalEventKind[] = [
  'HEALTH_STEP',
  'PREVENTIVE_STEP',
  'PREGNANCY_CHECK',
  'CALVING',
  'DRY_OFF',
  'TASK',
  'WEANING',
  'WITHDRAWAL_END',
];

export interface UpcomingEventCandidate {
  kind: AnimalEventKind;
  /** i18n key the client translates, e.g. `cattle.upcoming.pregnancyCheck`. */
  labelKey: string;
  labelParams?: Record<string, string | number>;
  dueAt: Date;
  /** `false` for informational items (a withdrawal ending) — never outranks an action. */
  actionable: boolean;
  /** Deep-link target. */
  ref: { type: string; id: string };
  /**
   * Set on a `TASK`: the domain event it was generated from, `"<sourceEventType>:<sourceEventId>"`
   * (`Task.sourceEventType` / `sourceEventId`).
   */
  sourceKey?: string;
  /** Source keys this event already represents, so a duplicate `TASK` for the same event and day is dropped. */
  coversSourceKeys?: string[];
}

export interface AnimalUpcomingEvent {
  kind: AnimalEventKind;
  labelKey: string;
  labelParams?: Record<string, string | number>;
  /** ISO instant. */
  dueAt: string;
  /** Whole farm-local days from today (negative once past). */
  daysUntil: number;
  urgency: AnimalEventUrgency;
  actionable: boolean;
  ref: { type: string; id: string };
}

export interface BuildUpcomingEventsOptions {
  now: Date;
  /** IANA zone of the farm (`Farm.timezone`). */
  timezone: string;
  windowDays?: number;
}

/** Whole calendar days from today to `due`, both read as the calendar date in `timezone`. */
export function farmDaysUntil(due: Date, timezone: string, now: Date): number {
  const dueDay = dayKey(localDateIso(timezone, due)).getTime();
  const today = dayKey(localDateIso(timezone, now)).getTime();
  return Math.round((dueDay - today) / DAY_MS);
}

export function urgencyForDaysUntil(daysUntil: number): AnimalEventUrgency {
  if (daysUntil < 0) return 'OVERDUE';
  if (daysUntil <= DUE_SOON_DAYS) return 'DUE_SOON';
  return 'LATER';
}

function kindRank(kind: AnimalEventKind): number {
  const idx = KIND_PRIORITY.indexOf(kind);
  return idx === -1 ? KIND_PRIORITY.length : idx;
}

function compareEvents(a: AnimalUpcomingEvent, b: AnimalUpcomingEvent): number {
  const aOverdue = a.urgency === 'OVERDUE';
  const bOverdue = b.urgency === 'OVERDUE';
  // Overdue first; among them the most overdue (earliest) first.
  if (aOverdue !== bOverdue) return aOverdue ? -1 : 1;
  // Then actions before information (a withdrawal ending never outranks a task).
  if (a.actionable !== b.actionable) return a.actionable ? -1 : 1;
  if (a.dueAt !== b.dueAt) return a.dueAt < b.dueAt ? -1 : 1;
  const byKind = kindRank(a.kind) - kindRank(b.kind);
  if (byKind !== 0) return byKind;
  const byRef = a.ref.id.localeCompare(b.ref.id);
  return byRef !== 0 ? byRef : a.labelKey.localeCompare(b.labelKey);
}

/**
 * One animal's events, filtered to the window, de-duplicated against Task Hub, urgency-tagged and ordered.
 *
 * - Within `windowDays` of today, plus everything overdue.
 * - A non-actionable item already past (a withdrawal that has ended) is not an event and is dropped.
 * - A `TASK` is dropped when another event covers the same source event on the same farm day.
 */
export function buildAnimalUpcomingEvents(
  candidates: UpcomingEventCandidate[],
  options: BuildUpcomingEventsOptions,
): AnimalUpcomingEvent[] {
  const { now, timezone } = options;
  const windowDays = options.windowDays ?? DEFAULT_WINDOW_DAYS;

  const covered = new Set<string>();
  for (const c of candidates) {
    if (c.kind === 'TASK' || !c.coversSourceKeys?.length) continue;
    const day = localDateIso(timezone, c.dueAt);
    for (const key of c.coversSourceKeys) covered.add(`${key}|${day}`);
  }

  const events: AnimalUpcomingEvent[] = [];
  for (const c of candidates) {
    const daysUntil = farmDaysUntil(c.dueAt, timezone, now);
    if (daysUntil > windowDays) continue;
    if (!c.actionable && daysUntil < 0) continue;
    if (
      c.kind === 'TASK' &&
      c.sourceKey &&
      covered.has(`${c.sourceKey}|${localDateIso(timezone, c.dueAt)}`)
    ) {
      continue;
    }
    events.push({
      kind: c.kind,
      labelKey: c.labelKey,
      ...(c.labelParams ? { labelParams: c.labelParams } : {}),
      dueAt: c.dueAt.toISOString(),
      daysUntil,
      urgency: urgencyForDaysUntil(daysUntil),
      actionable: c.actionable,
      ref: c.ref,
    });
  }
  return events.sort(compareEvents);
}
