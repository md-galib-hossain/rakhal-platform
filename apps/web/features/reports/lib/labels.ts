import type {
  DatePreset,
  ReportDomain,
  ReportOrigin,
  ReportScopeKind,
  ReportStatus,
  ReportType,
} from "../types";
import { isKnownMetricId, REPORT_SOURCES } from "./metric-ids";

/** next-intl's root translator (`useTranslations()`), reduced to what these helpers need. */
export type ReportTranslator = ((key: string) => string) & { has: (key: string) => boolean };

/* --------------------------------------------------------- enum key builders */

export const reportStatusKey = (s: ReportStatus) => `reports.status.${s}`;
export const reportTypeKey = (t: ReportType) => `reports.type.${t}`;
export const reportOriginKey = (o: ReportOrigin) => `reports.origin.${o}`;
export const reportScopeKindKey = (k: ReportScopeKind) => `reports.scopeKind.${k}`;
export const datePresetKey = (p: DatePreset) => `reports.preset.${p}`;
export const reportDomainKey = (d: ReportDomain) => `reports.domain.${d}`;

/* ------------------------------------------------------------------ metrics */

/** `reports.metrics.<id>.label` for a known id, else null (use {@link resolveMetricLabel} for a safe string). */
export function metricLabelKey(metricId: string): string | null {
  return isKnownMetricId(metricId) ? `reports.metrics.${metricId}.label` : null;
}

export function metricDefinitionKey(metricId: string): string | null {
  return isKnownMetricId(metricId) ? `reports.metrics.${metricId}.definition` : null;
}

/** `milk.cow_total_yield` -> `Cow total yield`; `reports.dq.x_y` -> `X y`. Never throws, never empty for non-empty input. */
export function humanizeMetricId(raw: string): string {
  const s = (raw ?? "").trim();
  if (!s) return "";
  const last = s.includes(".") ? s.slice(s.lastIndexOf(".") + 1) : s;
  const words = last
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : s;
}

/** Localized metric name; an id the frontend does not know yet falls back to a humanized string, never a raw id or a throw. */
export function resolveMetricLabel(metricId: string, t: ReportTranslator): string {
  const key = metricLabelKey(metricId);
  if (key && t.has(key)) return t(key);
  return humanizeMetricId(metricId);
}

export function resolveMetricDefinition(metricId: string, t: ReportTranslator): string | null {
  const key = metricDefinitionKey(metricId);
  return key && t.has(key) ? t(key) : null;
}

/* ------------------------------------------------------------------ sources */

const SOURCES = new Set<string>(REPORT_SOURCES);

/**
 * i18n key for a `MetricResult.source` / `BreakdownRow.source`, or null when unknown/absent.
 * `offeredMinusRefusal` reads "offered minus refusal, NOT measured intake" — never "consumed".
 */
export function sourceLabelKey(source: string | null | undefined): string | null {
  return source && SOURCES.has(source) ? `reports.sources.${source}` : null;
}

export function resolveSourceLabel(source: string | null | undefined, t: ReportTranslator): string | null {
  if (!source) return null;
  const key = sourceLabelKey(source);
  if (key && t.has(key)) return t(key);
  return humanizeMetricId(source);
}

/* ------------------------------------------------- backend-provided i18n keys */

const KEY_SHAPE = /^[a-z0-9_]+(\.[a-z0-9_]+)+$/i;

/**
 * Snapshot strings that are i18n keys (`titleKey`, `messageKey`, `dataQuality.notes[]`, a metric `reason`)
 * resolve through the root translator. A key the frontend has no text for becomes a humanized string; a
 * non-key (the backend sometimes sends short English text as a `reason`) is returned unchanged, so nothing
 * ever renders a raw `reports.foo.bar` key or throws.
 */
export function resolveBackendKey(key: string | null | undefined, t: ReportTranslator): string {
  const k = (key ?? "").trim();
  if (!k) return "";
  if (t.has(k)) return t(k);
  return KEY_SHAPE.test(k) ? humanizeMetricId(k) : k;
}

/** True when `reason` is a `reports.*` i18n key (vs free text). */
export const isReportsKey = (value: string | null | undefined): boolean =>
  !!value && value.startsWith("reports.") && KEY_SHAPE.test(value);
