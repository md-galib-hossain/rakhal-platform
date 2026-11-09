/**
 * Notifications v2 schedule math (RAKHAL-492, docs/EPIC_NOTIFICATIONS_V2.md §3.5). Pure: no Nest, no Prisma, no I/O.
 *
 * Rules that hold everywhere in this file:
 * - Calendar arithmetic (days, months) runs on the farm-local calendar (`YYYY-MM-DD`) and is converted to a UTC
 *   instant once, with `zonedToUtc`. An instant never gets `24h * N` added to it.
 * - An `allDay` anchor is a farm-local DATE stored as that date at UTC midnight (the `dayKey` convention); a timed
 *   anchor is a real instant whose farm-local wall clock time is preserved across a repeating series.
 * - A repeat is always computed from the series base and the index `k`, never from the previous anchor.
 */
import { localDateIso, zonedToUtc } from '../../../common/farm-time/farm-time';

export type ScheduleRepeatType = 'NONE' | 'EVERY_N_DAYS' | 'WEEKLY' | 'MONTHLY';
export type ScheduleTriggerType =
  | 'DATE'
  | 'BEFORE_EVENT'
  | 'AFTER_EVENT'
  | 'SOURCE_DUE';

/** Hard cap on a repeating series: anchors are indexed 0..399. */
export const SERIES_MAX_ANCHORS = 400;
export const MAX_LEADS = 4;
/** Longest lead, in minutes (90 days). */
export const MAX_LEAD_MINUTES = 90 * 1440;
export const DEFAULT_SEND_TIME = '08:00';
export const MAX_REPEAT_INTERVAL_DAYS = 365;
export const MAX_OFFSET_DAYS = 3650;
/** SYSTEM occurrences are spread over this many seconds so one timezone's 08:00 does not stampede (§3.3). */
export const SYSTEM_JITTER_SECONDS = 180;

const DAY_MIN = 1440;
const MINUTE_MS = 60_000;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;

// ---------------------------------------------------------------------------------------------------------------
// Farm-local calendar helpers
// ---------------------------------------------------------------------------------------------------------------

export function isValidSendTime(hm: string): boolean {
  return HM.test(hm);
}

/** `YYYY-MM-DD` shifted by `days` (negative allowed). Pure calendar arithmetic. */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

function daysInMonth(year: number, month1: number): number {
  return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}

/**
 * Same day-of-month as `baseYmd`, `months` months later, clamped to the month's last day. Computed from the base, so
 * Jan 31 -> Feb 28/29 -> Mar 31 (no drift to the 28th).
 */
export function addMonthsClampedYmd(baseYmd: string, months: number): string {
  const [y, m, d] = baseYmd.split('-').map(Number);
  const index = y * 12 + (m - 1) + months;
  const year = Math.floor(index / 12);
  const month1 = (index % 12) + 1;
  const day = Math.min(d, daysInMonth(year, month1));
  return `${String(year).padStart(4, '0')}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** `YYYY-MM-DD` of an allDay anchor (stored as the date at UTC midnight). */
export function allDayAnchorYmd(anchorAt: Date): string {
  return anchorAt.toISOString().slice(0, 10);
}

/** An allDay anchor instant for a farm-local date. */
export function allDayAnchorFromYmd(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** Farm-local `YYYY-MM-DD` and `HH:mm` of a timed anchor. */
export function localParts(
  instant: Date,
  timezone: string,
): { ymd: string; hm: string } {
  const ymd = localDateIso(timezone, instant);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(instant);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  return { ymd, hm: `${get('hour')}:${get('minute')}` };
}

/** Farm-local calendar day an anchor falls on (allDay: its stored date; timed: the wall-clock date). */
export function anchorLocalYmd(
  anchorAt: Date,
  allDay: boolean,
  timezone: string,
): string {
  return allDay
    ? allDayAnchorYmd(anchorAt)
    : localParts(anchorAt, timezone).ymd;
}

/** The inclusive end of a farm-local end date, stored as the UTC end of that calendar day. */
export function endOfDayKey(ymd: string): Date {
  return new Date(`${ymd}T23:59:59.999Z`);
}

// ---------------------------------------------------------------------------------------------------------------
// Leads
// ---------------------------------------------------------------------------------------------------------------

export type LeadError =
  | 'LEADS_EMPTY'
  | 'LEADS_TOO_MANY'
  | 'LEAD_NEGATIVE'
  | 'LEAD_TOO_LONG'
  | 'LEAD_NOT_WHOLE_DAYS'
  | 'LEAD_NOT_INTEGER';

/** Validates a lead list. allDay leads must be whole days (the send time is the time of day). */
export function validateLeads(
  leadMinutes: readonly number[],
  allDay: boolean,
): LeadError | null {
  if (leadMinutes.length === 0) return 'LEADS_EMPTY';
  if (leadMinutes.length > MAX_LEADS) return 'LEADS_TOO_MANY';
  for (const lead of leadMinutes) {
    if (!Number.isInteger(lead)) return 'LEAD_NOT_INTEGER';
    if (lead < 0) return 'LEAD_NEGATIVE';
    if (lead > MAX_LEAD_MINUTES) return 'LEAD_TOO_LONG';
    if (allDay && lead % DAY_MIN !== 0) return 'LEAD_NOT_WHOLE_DAYS';
  }
  return null;
}

/** De-duplicated, sorted descending (earliest fire first). */
export function normalizeLeads(leadMinutes: readonly number[]): number[] {
  return [...new Set(leadMinutes)].sort((a, b) => b - a);
}

// ---------------------------------------------------------------------------------------------------------------
// Fire time
// ---------------------------------------------------------------------------------------------------------------

export interface FireTimeInput {
  anchorAt: Date;
  allDay: boolean;
  /** Farm-local `HH:mm`; used when `allDay`. */
  sendTime?: string;
  leadMinutes: number;
  timezone: string;
}

/**
 * When one occurrence fires. allDay: `sendTime` farm-local on the anchor day minus `ceil(lead / 1440)` days.
 * Timed: the anchor instant minus `lead` minutes.
 */
export function computeFireAt(input: FireTimeInput): Date {
  const { anchorAt, allDay, leadMinutes, timezone } = input;
  if (!allDay) return new Date(anchorAt.getTime() - leadMinutes * MINUTE_MS);
  const leadDays = Math.ceil(leadMinutes / DAY_MIN);
  const ymd = addDaysYmd(allDayAnchorYmd(anchorAt), -leadDays);
  return zonedToUtc(timezone, ymd, input.sendTime ?? DEFAULT_SEND_TIME);
}

/** Deterministic 0..SYSTEM_JITTER_SECONDS-1 offset for a SYSTEM occurrence (FNV-1a of the id). */
export function jitterSeconds(occurrenceId: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < occurrenceId.length; i++) {
    hash ^= occurrenceId.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % SYSTEM_JITTER_SECONDS;
}

/** SYSTEM occurrences get jitter added to `fireAt`; manual (USER) times stay exact. */
export function applyJitter(
  fireAt: Date,
  occurrenceId: string,
  origin: 'SYSTEM' | 'USER',
): Date {
  if (origin !== 'SYSTEM') return fireAt;
  return new Date(fireAt.getTime() + jitterSeconds(occurrenceId) * 1000);
}

/**
 * Catalogue event key by urgency band (§3.3): manual -> `custom_reminder`; system lead > 0 -> `scheduled_upcoming`;
 * lead = 0 -> `scheduled_due`. (`scheduled_overdue` belongs to the overdue nag, which is not a schedule.)
 */
export function eventKeyForBand(
  origin: 'SYSTEM' | 'USER',
  leadMinutes: number,
): 'custom_reminder' | 'scheduled_upcoming' | 'scheduled_due' {
  if (origin === 'USER') return 'custom_reminder';
  return leadMinutes > 0 ? 'scheduled_upcoming' : 'scheduled_due';
}

// ---------------------------------------------------------------------------------------------------------------
// Trigger -> anchor
// ---------------------------------------------------------------------------------------------------------------

/**
 * Anchor of a BEFORE_EVENT / AFTER_EVENT schedule: the entity's date moved by `offsetDays` farm-local calendar days
 * (BEFORE subtracts, AFTER adds; `offsetDays` is the non-negative distance the API takes). A timed entity keeps its
 * wall clock time. Date-only entities (task due day, health step without a time) are `allDay`.
 */
export function anchorFromEntity(input: {
  trigger: 'BEFORE_EVENT' | 'AFTER_EVENT';
  entityAt: Date;
  offsetDays: number;
  allDay: boolean;
  timezone: string;
}): Date {
  const { trigger, entityAt, offsetDays, allDay, timezone } = input;
  const signed = trigger === 'BEFORE_EVENT' ? -offsetDays : offsetDays;
  if (allDay) {
    return allDayAnchorFromYmd(addDaysYmd(allDayAnchorYmd(entityAt), signed));
  }
  const { ymd, hm } = localParts(entityAt, timezone);
  return zonedToUtc(timezone, addDaysYmd(ymd, signed), hm);
}

/** A BEFORE_EVENT on an event whose moment already passed can never fire (422 ANCHOR_NOT_IN_FUTURE). */
export function isAnchorInFuture(anchorAt: Date, now: Date): boolean {
  return anchorAt.getTime() > now.getTime();
}

// ---------------------------------------------------------------------------------------------------------------
// Repeat series
// ---------------------------------------------------------------------------------------------------------------

export interface SeriesInput {
  baseAnchorAt: Date;
  allDay: boolean;
  repeat: ScheduleRepeatType;
  repeatInterval?: number | null;
  /** Inclusive end, as stored: the UTC end of the farm-local end date. */
  repeatEndDate?: Date | null;
  timezone: string;
}

/**
 * Anchor number `k` of the series, computed from the base. Returns null when `k` is past the 400-anchor cap, past the
 * inclusive end date, or `k > 0` for a non-repeating schedule.
 */
export function anchorForIndex(series: SeriesInput, k: number): Date | null {
  if (!Number.isInteger(k) || k < 0 || k >= SERIES_MAX_ANCHORS) return null;
  const { baseAnchorAt, allDay, repeat, timezone } = series;
  if (repeat === 'NONE' && k > 0) return null;

  const baseYmd = anchorLocalYmd(baseAnchorAt, allDay, timezone);
  let ymd = baseYmd;
  if (repeat === 'EVERY_N_DAYS') {
    const interval = series.repeatInterval ?? 0;
    if (interval < 1) return null;
    ymd = addDaysYmd(baseYmd, k * interval);
  } else if (repeat === 'WEEKLY') {
    ymd = addDaysYmd(baseYmd, 7 * k);
  } else if (repeat === 'MONTHLY') {
    ymd = addMonthsClampedYmd(baseYmd, k);
  }

  if (series.repeatEndDate && ymd > allDayAnchorYmd(series.repeatEndDate)) {
    return null;
  }
  if (allDay) return allDayAnchorFromYmd(ymd);
  return zonedToUtc(timezone, ymd, localParts(baseAnchorAt, timezone).hm);
}

export interface PlannedOccurrence {
  anchorAt: Date;
  leadMinutes: number;
  fireAt: Date;
}

/** The occurrences of one anchor whose fire time has not passed. Past leads are dropped silently (no row). */
export function liveOccurrencesForAnchor(input: {
  anchorAt: Date;
  allDay: boolean;
  sendTime?: string;
  leadMinutes: readonly number[];
  timezone: string;
  now: Date;
}): PlannedOccurrence[] {
  const { anchorAt, allDay, sendTime, timezone, now } = input;
  return normalizeLeads(input.leadMinutes)
    .map((leadMinutes) => ({
      anchorAt,
      leadMinutes,
      fireAt: computeFireAt({
        anchorAt,
        allDay,
        sendTime,
        leadMinutes,
        timezone,
      }),
    }))
    .filter((o) => o.fireAt.getTime() >= now.getTime());
}

export interface PlannedSeriesStart {
  seriesIndex: number;
  anchorAt: Date;
  occurrences: PlannedOccurrence[];
}

type SeriesWithLeads = SeriesInput & {
  sendTime?: string;
  leadMinutes: readonly number[];
};

/**
 * First anchor at or after `fromIndex` that still has at least one occurrence in the future. Used on create (so a
 * series started in the past begins at its first live anchor) and to advance after an anchor finishes. Null = nothing
 * live is left: the schedule is DONE, or for a one-off manual DATE schedule a 422.
 */
export function firstLiveAnchor(
  series: SeriesWithLeads,
  fromIndex: number,
  now: Date,
): PlannedSeriesStart | null {
  for (let k = fromIndex; k < SERIES_MAX_ANCHORS; k++) {
    const anchorAt = anchorForIndex(series, k);
    if (!anchorAt) return null;
    const occurrences = liveOccurrencesForAnchor({
      anchorAt,
      allDay: series.allDay,
      sendTime: series.sendTime,
      leadMinutes: series.leadMinutes,
      timezone: series.timezone,
      now,
    });
    if (occurrences.length > 0) {
      return { seriesIndex: k, anchorAt, occurrences };
    }
    if (series.repeat === 'NONE') return null;
  }
  return null;
}

/** Anchor after `currentIndex`, with its live occurrences; null when the series ended (cap or end date). */
export function advanceSeries(
  series: SeriesWithLeads,
  currentIndex: number,
  now: Date,
): PlannedSeriesStart | null {
  if (series.repeat === 'NONE') return null;
  return firstLiveAnchor(series, currentIndex + 1, now);
}

// ---------------------------------------------------------------------------------------------------------------
// Repeat / date validation
// ---------------------------------------------------------------------------------------------------------------

export type RepeatError =
  | 'REPEAT_INTERVAL_REQUIRED'
  | 'REPEAT_INTERVAL_OUT_OF_RANGE'
  | 'REPEAT_END_BEFORE_START'
  | 'REPEAT_END_INVALID';

export function validateRepeat(input: {
  repeat: ScheduleRepeatType;
  repeatInterval?: number | null;
  /** Farm-local `YYYY-MM-DD`. */
  endDateYmd?: string | null;
  /** Farm-local date of the first anchor. */
  startYmd: string;
}): RepeatError | null {
  if (input.repeat === 'NONE') return null;
  if (input.repeat === 'EVERY_N_DAYS') {
    if (input.repeatInterval == null) return 'REPEAT_INTERVAL_REQUIRED';
    if (
      !Number.isInteger(input.repeatInterval) ||
      input.repeatInterval < 1 ||
      input.repeatInterval > MAX_REPEAT_INTERVAL_DAYS
    ) {
      return 'REPEAT_INTERVAL_OUT_OF_RANGE';
    }
  }
  if (input.endDateYmd != null) {
    if (!YMD.test(input.endDateYmd)) return 'REPEAT_END_INVALID';
    if (input.endDateYmd < input.startYmd) return 'REPEAT_END_BEFORE_START';
  }
  return null;
}
