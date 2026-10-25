import type { Locale } from "@/lib/constants/i18n";
import { formatDate, formatNumber, formatSignedPct } from "@/lib/format";
import type { MetricValue, ReportPeriod, ReportSummaryPeriod } from "../types";

export const NOT_APPLICABLE_DASH = "—";

/** Keys for the non-value states (root translator). */
export const METRIC_STATE_KEYS = {
  missing: "reports.states.missing",
  not_calculated: "reports.states.not_calculated",
  not_applicable: "reports.states.not_applicable",
} as const;

type Translate = (key: string) => string;

/** Unit code -> `reports.units.<key>` (for suffix labels). `null` = no suffix / handled specially. */
const UNIT_KEYS: Readonly<Record<string, string | null>> = {
  L: "reports.units.L",
  kg: "reports.units.kg",
  cows: "reports.units.cows",
  "cow-days": "reports.units.cowDays",
  days: "reports.units.days",
  cases: "reports.units.cases",
  withdrawals: "reports.units.withdrawals",
  items: "reports.units.items",
  tasks: "reports.units.tasks",
  treatments: "reports.units.treatments",
  count: null,
  "%": null,
  BDT: null,
  "BDT/cow-day": "reports.units.perCowDay",
  "BDT/L": "reports.units.perLitre",
};

/** i18n key of a unit's suffix label, or null when the unit prints no suffix (count, %, BDT) or is unknown. */
export function unitLabelKey(unit: string): string | null {
  return UNIT_KEYS[unit] ?? null;
}

const MAX_FRACTION = 2;

function formatValueNumber(value: number, locale: Locale): string {
  // Round first so a float artefact (0.30000000000000004) never leaks, then group by locale.
  return formatNumber(value, locale, { maximumFractionDigits: MAX_FRACTION });
}

/**
 * Display rules (EPIC_REPORTS section 8):
 * - `value`          -> localized number + unit (BDT -> `৳` prefix; `%` suffix; `L`, `kg`, `cow-days`, `days`, `cows` labelled).
 * - `missing`        -> "Not recorded"
 * - `not_calculated` -> "Not calculated"
 * - `not_applicable` -> an em dash
 * A non-value NEVER renders as 0, and a `value` carrying NaN/Infinity (a backend bug) renders as "Not calculated", not "NaN".
 *
 * `unitOverride` lets a caller force the unit text (e.g. the template catalogue's unit); the value's own unit is used otherwise.
 */
export function formatMetricValue(
  metric: MetricValue,
  locale: Locale,
  t: Translate,
  unitOverride?: string,
): string {
  switch (metric.state) {
    case "missing":
      return t(METRIC_STATE_KEYS.missing);
    case "not_calculated":
      return t(METRIC_STATE_KEYS.not_calculated);
    case "not_applicable":
      return NOT_APPLICABLE_DASH;
    case "value": {
      if (!Number.isFinite(metric.value)) return t(METRIC_STATE_KEYS.not_calculated);
      const unit = unitOverride ?? metric.unit;
      const num = formatValueNumber(metric.value, locale);
      if (unit === "BDT") return `৳${num}`;
      if (unit === "BDT/cow-day" || unit === "BDT/L") {
        const key = unitLabelKey(unit);
        return key ? `৳${num} ${t(key)}` : `৳${num}`;
      }
      if (unit === "%") return `${num}%`;
      if (unit === "count" || unit === "") return num;
      const key = unitLabelKey(unit);
      return `${num} ${key ? t(key) : unit}`;
    }
  }
}

/** Number only (no unit), for table columns whose header already carries the unit. Non-values keep their text. */
export function formatMetricNumber(metric: MetricValue, locale: Locale, t: Translate): string {
  if (metric.state !== "value") return formatMetricValue(metric, locale, t);
  if (!Number.isFinite(metric.value)) return t(METRIC_STATE_KEYS.not_calculated);
  return formatValueNumber(metric.value, locale);
}

/** Signed change, 1 decimal ("+12.5%", "−3%"); `null`/`undefined`/NaN (no valid comparison) is an em dash, never "0%". */
export function formatPercentChange(percent: number | null | undefined): string {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return NOT_APPLICABLE_DASH;
  const rounded = Math.round(percent * 10) / 10;
  if (rounded === 0) return "0%";
  return formatSignedPct(rounded);
}

/** Parse a farm-local `YYYY-MM-DD` as a local Date (no UTC shift, so the printed day never moves). */
function ymdToLocalDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

/** "1 Oct, 2026" for one day, "1 Oct, 2026 – 31 Oct, 2026" for a range. Falls back to the raw strings on bad input. */
export function periodLabel(
  period: Pick<ReportPeriod | ReportSummaryPeriod, "startDate" | "endDate">,
  locale: Locale,
): string {
  const start = ymdToLocalDate(period.startDate);
  const end = ymdToLocalDate(period.endDate);
  if (!start || !end) return `${period.startDate} – ${period.endDate}`;
  if (period.startDate === period.endDate) return formatDate(start, locale);
  return `${formatDate(start, locale)} – ${formatDate(end, locale)}`;
}
