import type { DatePreset } from "../../types";
import { inclusiveDays, isValidYmd } from "../../lib/ymd";

/**
 * Display-only mirror of the backend's `resolvePreset` + `previousEquivalentPeriod`
 * (`reports/domain/period/period-resolver.ts`) so the wizard can show "what will this cover" and "what is it
 * compared with" before anything is sent. The server stays the source of truth: it recomputes both from the
 * preset and the farm timezone, and none of these dates is ever sent as a preset's range.
 */

export interface DayRange {
  startDate: string;
  endDate: string;
}

export interface WizardPeriodView {
  /** The period the report covers (full week/month/year for a preset, even if it is still running). */
  period: DayRange;
  /** The part of `period` that is compared (cut at today while the period is in progress). */
  current: DayRange;
  previous: DayRange;
  /** The current week/month/year is still running, so both sides compare the same number of elapsed days. */
  partial: boolean;
}

const pad = (n: number) => String(n).padStart(2, "0");

function parse(ymd: string): { y: number; m: number; d: number } {
  const [y, m, d] = ymd.split("-").map(Number);
  return { y, m, d };
}

function make(y: number, m: number, d: number): string {
  return `${y}-${pad(m)}-${pad(d)}`;
}

const utc = (ymd: string) => {
  const { y, m, d } = parse(ymd);
  return Date.UTC(y, m - 1, d);
};

export function addDays(ymd: string, days: number): string {
  const dt = new Date(utc(ymd) + days * 86_400_000);
  return make(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** ISO weekday, Monday = 1 … Sunday = 7. */
function isoWeekday(ymd: string): number {
  const wd = new Date(utc(ymd)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

const mondayOf = (ymd: string) => addDays(ymd, 1 - isoWeekday(ymd));

const diffDays = (from: string, to: string) => Math.round((utc(to) - utc(from)) / 86_400_000);

function fullPrevious(kind: "day" | "week" | "month" | "year", start: string): DayRange {
  switch (kind) {
    case "day": {
      const p = addDays(start, -1);
      return { startDate: p, endDate: p };
    }
    case "week": {
      const s = addDays(start, -7);
      return { startDate: s, endDate: addDays(s, 6) };
    }
    case "month": {
      const { y, m } = parse(start);
      const py = m === 1 ? y - 1 : y;
      const pm = m === 1 ? 12 : m - 1;
      return { startDate: make(py, pm, 1), endDate: make(py, pm, daysInMonth(py, pm)) };
    }
    case "year": {
      const { y } = parse(start);
      return { startDate: make(y - 1, 1, 1), endDate: make(y - 1, 12, 31) };
    }
  }
}

/**
 * Resolve the period the backend will report for `preset` on farm-local `today`. Returns null for an unusable
 * custom range (missing/invalid/inverted dates) — the form schema reports why.
 */
export function resolveWizardPeriod(
  preset: DatePreset,
  today: string,
  custom?: { startDate?: string; endDate?: string },
): WizardPeriodView | null {
  if (!isValidYmd(today)) return null;
  const { y, m } = parse(today);
  let kind: "day" | "week" | "month" | "year" | "custom";
  let current: DayRange;
  switch (preset) {
    case "today":
      kind = "day";
      current = { startDate: today, endDate: today };
      break;
    case "this_week": {
      kind = "week";
      const mon = mondayOf(today);
      current = { startDate: mon, endDate: addDays(mon, 6) };
      break;
    }
    case "this_month":
      kind = "month";
      current = { startDate: make(y, m, 1), endDate: make(y, m, daysInMonth(y, m)) };
      break;
    case "this_year":
      kind = "year";
      current = { startDate: make(y, 1, 1), endDate: make(y, 12, 31) };
      break;
    case "custom": {
      const s = custom?.startDate;
      const e = custom?.endDate;
      if (!s || !e || !isValidYmd(s) || !isValidYmd(e) || s > e) return null;
      kind = "custom";
      current = { startDate: s, endDate: e };
      break;
    }
    default:
      return null;
  }

  if (kind === "custom") {
    const len = inclusiveDays(current.startDate, current.endDate);
    return {
      period: current,
      current,
      previous: { startDate: addDays(current.startDate, -len), endDate: addDays(current.startDate, -1) },
      partial: false,
    };
  }

  const full = fullPrevious(kind, current.startDate);
  const inProgress = kind !== "day" && today >= current.startDate && today <= current.endDate;
  if (!inProgress) return { period: current, current, previous: full, partial: false };

  const elapsed = diffDays(current.startDate, today) + 1;
  const prevEnd = addDays(full.startDate, elapsed - 1);
  return {
    period: current,
    current: { startDate: current.startDate, endDate: today },
    previous: { startDate: full.startDate, endDate: prevEnd > full.endDate ? full.endDate : prevEnd },
    partial: true,
  };
}
