import { addDaysLocalIso } from "@/lib/local-date";

/** Default voluntary waiting period; the per-farm setting is not exposed to the web client yet. */
export const DEFAULT_VWP_DAYS = 60;
const PD_CHECK_AFTER_SERVICE = 35;
const GESTATION_DAYS = 283;
const LACTATION_SPAN = 365;

export type PhaseKey = "calving" | "vwp" | "bred" | "check" | "due";
export interface PhaseMarker {
  key: PhaseKey;
  /** 0–100 position on the bar. */
  pct: number;
  /** Recorded (filled) or projected (hollow). */
  recorded: boolean;
  date: string;
}
export interface PhaseBar {
  markers: PhaseMarker[];
  /** 0–100 position of today, null when the animal has no calving day to anchor to. */
  todayPct: number | null;
}

function dayDiff(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

const clamp = (n: number) => Math.max(0, Math.min(100, n));

/**
 * Reproduction phase bar (06 §5): calving, VWP end, bred, PD check, due. A cow is anchored on her last calving day
 * (today minus DIM); a heifer that has never calved is anchored on the service date. Markers whose date is in the past
 * and known are "recorded"; the rest are projected. Returns null when there is nothing to anchor on.
 */
export function buildPhaseBar(input: {
  today: string;
  dim: number | null;
  lastBreeding: string | null;
  expectedCalvingDate: string | null;
  pregnant: boolean;
  vwpDays?: number;
}): PhaseBar | null {
  const { today, dim, lastBreeding, expectedCalvingDate, pregnant } = input;
  const vwp = input.vwpDays ?? DEFAULT_VWP_DAYS;
  const calvingDate = dim != null ? addDaysLocalIso(today, -dim) : null;
  const served = lastBreeding?.slice(0, 10) ?? null;
  const anchor = calvingDate ?? served;
  if (!anchor) return null;
  const bredDate = served && served >= anchor ? served : null;
  const dueDate = pregnant && expectedCalvingDate ? expectedCalvingDate.slice(0, 10) : bredDate ? addDaysLocalIso(bredDate, GESTATION_DAYS) : null;
  const span = Math.max(dueDate ? dayDiff(anchor, dueDate) : LACTATION_SPAN, dayDiff(anchor, today), 1);
  const at = (date: string) => clamp((dayDiff(anchor, date) / span) * 100);

  const markers: PhaseMarker[] = [];
  if (calvingDate) {
    markers.push({ key: "calving", pct: 0, recorded: true, date: calvingDate });
    const vwpEnd = addDaysLocalIso(calvingDate, vwp);
    markers.push({ key: "vwp", pct: at(vwpEnd), recorded: vwpEnd <= today, date: vwpEnd });
  }
  if (bredDate) {
    markers.push({ key: "bred", pct: at(bredDate), recorded: true, date: bredDate });
    const check = addDaysLocalIso(bredDate, PD_CHECK_AFTER_SERVICE);
    markers.push({ key: "check", pct: at(check), recorded: pregnant || check <= today, date: check });
  }
  if (dueDate) markers.push({ key: "due", pct: at(dueDate), recorded: false, date: dueDate });
  return { markers, todayPct: calvingDate ? at(today) : null };
}

/** Milk figures for the card from the animal's daily records (`recent_milk_records`, any order). */
export function milkFigures(records: { date: string; total_l: number }[], today: string) {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const weekStart = addDaysLocalIso(today, -6);
  const week = sorted.filter((r) => r.date >= weekStart && r.date <= today);
  return {
    series: sorted.slice(-14).map((r) => r.total_l),
    today: sorted.find((r) => r.date === today)?.total_l ?? null,
    weekTotal: week.reduce((sum, r) => sum + r.total_l, 0),
    hasData: sorted.length > 0,
  };
}

/** Weight change over (at most) the last 30 days; null with fewer than 2 points. */
export function weightTrend(history: { date: string; weight_kg: number }[], today: string) {
  const sorted = [...history].sort((a, b) => a.date.localeCompare(b.date));
  const series = sorted.map((p) => p.weight_kg);
  if (sorted.length < 2) return { series, delta30: null as number | null };
  const last = sorted[sorted.length - 1];
  const from = addDaysLocalIso(today, -30);
  const base = sorted.find((p) => p.date >= from && p !== last) ?? sorted[sorted.length - 2];
  return { series, delta30: Math.round((last.weight_kg - base.weight_kg) * 10) / 10 };
}

/** Which Overview cards apply (06 §5: no reproduction card for bulls, steers and calves). */
export function overviewCards(cattle: { gender: string; animalCategory: string; productionStatus: string | null }) {
  const female = cattle.gender === "FEMALE";
  return {
    reproduction: female && (cattle.animalCategory === "HEIFER" || cattle.animalCategory === "COW"),
    milk: female && (cattle.animalCategory === "COW" || cattle.productionStatus != null),
  };
}
