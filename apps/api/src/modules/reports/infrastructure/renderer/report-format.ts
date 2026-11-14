import type { MetricValue } from '../../domain/contracts/metric-value';
import { asText, keyLabel } from './report-labels';

/** Display texts for non-value states. Missing and not-calculated are NEVER rendered as 0. */
export const TEXT_MISSING = 'Not recorded';
export const TEXT_NOT_CALCULATED = 'Not calculated';
export const TEXT_NOT_APPLICABLE = '—';
export const TAKA = '৳';

const NF = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  useGrouping: true,
});

export function formatNumber(n: number): string {
  if (!Number.isFinite(n)) return TEXT_NOT_APPLICABLE;
  const s = NF.format(n);
  // Intl can print "-0" for tiny negatives.
  return s === '-0' ? '0' : s;
}

export interface FormattedValue {
  state: MetricValue['state'];
  /** The number part only (or the state text). */
  text: string;
  /** The unit part, e.g. `L`, `kg`, `/ L`. Empty for BDT, percent and bare counts. */
  unit: string;
  /** Free text explaining a non-value state (already mapped through the label dictionary). */
  detail?: string;
}

const COUNT_UNITS = new Set(['count', 'cows', 'items', '']);

/** Formats a MetricValue. The number printed always equals the payload number (max 2 decimals). */
export function formatValue(v: MetricValue): FormattedValue {
  switch (v.state) {
    case 'value': {
      const num = formatNumber(v.value);
      const unit = v.unit;
      if (unit === 'BDT')
        return { state: 'value', text: `${TAKA}${num}`, unit: '' };
      if (unit.startsWith('BDT/')) {
        return {
          state: 'value',
          text: `${TAKA}${num}`,
          unit: `/ ${unit.slice(4)}`,
        };
      }
      if (unit === '%') return { state: 'value', text: `${num}%`, unit: '' };
      if (COUNT_UNITS.has(unit)) {
        return {
          state: 'value',
          text: num,
          unit: unit === 'cows' || unit === 'items' ? unit : '',
        };
      }
      return { state: 'value', text: num, unit };
    }
    case 'missing':
      return {
        state: 'missing',
        text: TEXT_MISSING,
        unit: '',
        detail: v.reason ? keyLabel(v.reason) : undefined,
      };
    case 'not_calculated':
      return {
        state: 'not_calculated',
        text: TEXT_NOT_CALCULATED,
        unit: '',
        detail: v.reason ? keyLabel(v.reason) : undefined,
      };
    default:
      return { state: 'not_applicable', text: TEXT_NOT_APPLICABLE, unit: '' };
  }
}

/** `12.5 L`, `৳450`, `Not recorded`. */
export function formatFull(v: MetricValue): string {
  const f = formatValue(v);
  return f.unit ? `${f.text} ${f.unit}` : f.text;
}

export interface DeltaText {
  text: string;
  direction: 'up' | 'down' | 'flat' | 'none';
}

/** Percent change text. Null (no baseline / not comparable) renders as an em dash, never 0%. */
export function formatPercentChange(pct: number | null): DeltaText {
  if (pct === null || !Number.isFinite(pct)) {
    return { text: TEXT_NOT_APPLICABLE, direction: 'none' };
  }
  const rounded = Math.round(pct * 10) / 10;
  if (rounded === 0) return { text: '0.0%', direction: 'flat' };
  const sign = rounded > 0 ? '+' : '−';
  return {
    text: `${sign}${Math.abs(rounded).toFixed(1)}%`,
    direction: rounded > 0 ? 'up' : 'down',
  };
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export const monthName = (m1: number): string => MONTHS[m1 - 1] ?? '';

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseYmd(
  s: string,
): { y: number; m: number; d: number } | null {
  const m = DATE_RE.exec(s);
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}

/** `2026-05-12` -> `12 May`; unparsable input is returned unchanged. */
export function shortDate(s: string): string {
  const p = parseYmd(s);
  return p ? `${p.d} ${monthName(p.m).slice(0, 3)}` : s;
}

/** `12–18 May 2026`, `28 Apr – 4 May 2026`, `1 May 2026`. */
export function formatRange(start: string, end: string): string {
  const a = parseYmd(start);
  const b = parseYmd(end);
  if (!a || !b) return `${start} – ${end}`;
  if (start === end) return `${a.d} ${monthName(a.m)} ${a.y}`;
  if (a.y === b.y && a.m === b.m) {
    return `${a.d}–${b.d} ${monthName(b.m)} ${b.y}`;
  }
  if (a.y === b.y) {
    return `${a.d} ${monthName(a.m).slice(0, 3)} – ${b.d} ${monthName(b.m).slice(0, 3)} ${b.y}`;
  }
  return `${a.d} ${monthName(a.m).slice(0, 3)} ${a.y} – ${b.d} ${monthName(b.m).slice(0, 3)} ${b.y}`;
}

export function daysBetweenInclusive(
  start: string,
  end: string,
): number | null {
  const a = parseYmd(start);
  const b = parseYmd(end);
  if (!a || !b) return null;
  return (
    Math.round(
      (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000,
    ) + 1
  );
}

/** `19 May 2026, 10:32` in the farm timezone (falls back to UTC on a bad zone). */
export function formatInstant(iso: string, timeZone: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const make = (tz: string): string =>
    new Intl.DateTimeFormat('en-GB', {
      timeZone: tz,
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    })
      .format(d)
      .replace(',', ' ·');
  try {
    return make(timeZone);
  } catch {
    return `${make('UTC')} UTC`;
  }
}

/** Keeps absurd strings from blowing up a cell: hard cap with an ellipsis. */
export function stripControl(s: string): string {
  let out = '';
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    out += c < 32 || c === 127 ? ' ' : s[i];
  }
  return out;
}

export function clampText(s: unknown, max = 120): string {
  const t = stripControl(asText(s)).trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
