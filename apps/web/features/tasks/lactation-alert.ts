import {
  CalendarX2,
  TrendingDown,
  Gauge,
  HeartCrack,
  CalendarClock,
  CalendarCheck2,
  CalendarOff,
  Droplets,
  type LucideIcon,
} from "lucide-react";

/**
 * RAKHAL-286's 8-alert lactation set, raised as Task Hub tasks (not a dedicated
 * notification channel). The backend embeds a `[LACTATION_ALERT:<TAG>]` marker at the
 * start of `Task.details` for dedupe purposes (see `scheduler.service.ts#raiseLactationAlertTask`)
 * — date-scoped tags carry a trailing `:<ISO date>` (e.g. `MISSING_SESSION:2026-08-06`).
 * This module recognizes the marker so the generic task list can strip it from the
 * displayed description and show a type-specific icon/label instead of a raw bracket.
 */
export type LactationAlertKind =
  | "MISSING_SESSION"
  | "SUDDEN_DROP"
  | "LOW_PEAK_BY_DIM"
  | "LONG_LACTATION_NOT_PREGNANT"
  | "DRY_OFF_APPROACHING"
  | "PLANNED_DRY_OFF_DUE"
  | "DRY_OFF_OVERDUE"
  | "LOW_PRODUCTION_DRY_OFF_REVIEW";

export const LACTATION_ALERT_ICON: Record<LactationAlertKind, LucideIcon> = {
  MISSING_SESSION: CalendarX2,
  SUDDEN_DROP: TrendingDown,
  LOW_PEAK_BY_DIM: Gauge,
  LONG_LACTATION_NOT_PREGNANT: HeartCrack,
  DRY_OFF_APPROACHING: CalendarClock,
  PLANNED_DRY_OFF_DUE: CalendarCheck2,
  DRY_OFF_OVERDUE: CalendarOff,
  LOW_PRODUCTION_DRY_OFF_REVIEW: Droplets,
};

/** High-severity tags surface as a "destructive" chip, the rest as "warning" — mirrors the
 * backend's own `TaskPriority.HIGH` assignment for SUDDEN_DROP / PLANNED_DRY_OFF_DUE / DRY_OFF_OVERDUE. */
const HIGH_SEVERITY: ReadonlySet<LactationAlertKind> = new Set([
  "SUDDEN_DROP",
  "PLANNED_DRY_OFF_DUE",
  "DRY_OFF_OVERDUE",
]);

export function lactationAlertSeverity(kind: LactationAlertKind): "destructive" | "warning" {
  return HIGH_SEVERITY.has(kind) ? "destructive" : "warning";
}

const MARKER_RE = /^\[LACTATION_ALERT:([A-Z_]+)(?::[^\]]*)?\]\s*/;

/** Parses a leading `[LACTATION_ALERT:<TAG>]` marker off `details`, returning the alert kind and
 * the description with the marker stripped. Returns `null` for tasks with no marker, or an
 * unrecognized tag (forward-compat: an unknown future tag falls back to showing details as-is
 * rather than silently dropping text). */
export function parseLactationAlert(
  details: string | null,
): { kind: LactationAlertKind; cleanDetails: string } | null {
  if (!details) return null;
  const match = MARKER_RE.exec(details);
  if (!match) return null;
  const kind = match[1];
  if (!(kind in LACTATION_ALERT_ICON)) return null;
  return { kind: kind as LactationAlertKind, cleanDetails: details.slice(match[0].length) };
}
