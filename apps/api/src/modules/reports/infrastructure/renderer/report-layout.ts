import {
  FINANCE_SOURCE_DENYLIST,
  type ReportSnapshotPayload,
  type SnapshotSection,
} from '../../domain/contracts/snapshot';
import type {
  BreakdownRow,
  MetricResult,
  MetricValue,
} from '../../domain/contracts/metric-value';
import type { ReportType } from '../../domain/contracts/enums';
import type { ReportPeriod } from '../../domain/contracts/period';
import { COW_KEYED_ROW_METRIC_IDS } from '../../application/pipeline/report-compute.service';
import {
  TEXT_MISSING,
  clampText,
  daysBetweenInclusive,
  formatFull,
  formatInstant,
  formatNumber,
  formatPercentChange,
  formatRange,
  formatValue,
  monthName,
  parseYmd,
  shortDate,
  type DeltaText,
} from './report-format';
import { humanize, keyLabel, metricLabel, sourceLabel } from './report-labels';

/**
 * Pure layout model (no pdfkit). Built ONLY from the snapshot payload: block kinds and content are
 * driven by metric ids, units, sources and the template's sections, never by a per-report-type
 * template. Weekly / monthly / on-demand differ only by section content and the title text.
 */

export type ReportKind = 'weekly' | 'monthly' | 'snapshot';

export interface KpiCard {
  id: string;
  label: string;
  valueText: string;
  unitText: string;
  state: 'value' | 'missing' | 'not_calculated' | 'not_applicable';
  detail?: string;
  delta?: DeltaText;
  sourceLabel?: string;
}

export interface TableColumn {
  label: string;
  align: 'left' | 'right';
  /** Relative width. */
  weight: number;
}

export interface TableSpec {
  columns: TableColumn[];
  rows: string[][];
  /** Printed under the table when rows were cut at MAX_TABLE_ROWS. */
  note?: string;
  /** Pagination hints for the writer. */
  repeatHeader: true;
  minRowsBeforeBreak: number;
  avoidOrphanRows: number;
}

export interface ChartPoint {
  label: string;
  /** Null when the day/entry has no recorded value (a gap, never 0). */
  value: number | null;
  text: string;
}

export interface RankedRow {
  rank: number;
  label: string;
  value: number;
  text: string;
}

export type LayoutBlock =
  | {
      type: 'hero';
      eyebrow: string;
      valueText: string;
      unitText: string;
      state: KpiCard['state'];
      delta?: DeltaText;
      caption?: string;
      sideLabel: string;
      sideLines: string[];
    }
  | { type: 'section'; title: string; subtitle?: string }
  | { type: 'kpis'; cards: KpiCard[] }
  | {
      type: 'line' | 'bar';
      title: string;
      unitLabel: string;
      points: ChartPoint[];
      footnote?: string;
    }
  | {
      type: 'donut';
      title: string;
      centerText: string;
      centerCaption: string;
      slices: { label: string; value: number; text: string }[];
      footnote?: string;
    }
  | {
      type: 'ranked';
      title: string;
      unitLabel: string;
      rows: RankedRow[];
      footnote?: string;
      table?: TableSpec;
    }
  | { type: 'table'; title: string; table: TableSpec }
  | {
      type: 'exceptions';
      title: string;
      items: { text: string; detail?: string }[];
    }
  | {
      type: 'notice';
      tone: 'restricted' | 'info';
      title: string;
      text: string;
    }
  | {
      type: 'dataQuality';
      title: string;
      coverage?: string;
      rules: string[];
      notes: string[];
    };

export interface ReportLayout {
  kind: ReportKind;
  title: string;
  eyebrow: string;
  /** Right side of the page header. */
  headerRight: string[];
  farmName: string;
  meta: { label: string; value: string }[];
  /** Footer left text, e.g. `RAKHAL · Weekly report`. */
  footerLabel: string;
  blocks: LayoutBlock[];
}

export const TOP_N = 10;
/** Donut legend cap: the largest DONUT_MAX_SLICES - 1 slices, then one labelled "Other" with the summed value. */
export const DONUT_MAX_SLICES = 8;
/** Hard cap on rows rendered in any one table (a protection, not a product limit). */
export const MAX_TABLE_ROWS = 5000;
const DONUT_METRICS = new Set(['milk.disposition_yield']);
const PER_COW_MILK = /^milk\.cow_/;
const PRE_RANKED = /(^|\.)(top|bottom)_/;

/* ----------------------------- report kind ----------------------------- */

const KIND_BY_TYPE: Record<ReportType, ReportKind> = {
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  ON_DEMAND: 'snapshot',
};

export function detectKind(period: ReportPeriod): ReportKind {
  const days = daysBetweenInclusive(period.startDate, period.endDate);
  const a = parseYmd(period.startDate);
  const b = parseYmd(period.endDate);
  if (!days || !a || !b) return 'snapshot';
  const dow = new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay(); // 1 = Monday
  if (days === 7 && dow === 1) return 'weekly';
  const lastOfMonth = new Date(Date.UTC(b.y, b.m, 0)).getUTCDate();
  if (a.d === 1 && a.y === b.y && a.m === b.m && b.d === lastOfMonth) {
    return 'monthly';
  }
  return 'snapshot';
}

/* ------------------------------ finance gate ---------------------------- */

const isFinanceUnit = (u: string): boolean =>
  u === 'BDT' || u.startsWith('BDT/');
const isFinanceSource = (s: string | null | undefined): boolean =>
  !!s && (FINANCE_SOURCE_DENYLIST.includes(s) || s.startsWith('ledger'));

const valueIsFinance = (v: MetricValue | undefined): boolean =>
  !!v && v.state === 'value' && isFinanceUnit(v.unit);

function metricIsFinance(m: MetricResult): boolean {
  if (m.requiresPermission === 'finance.read') return true;
  if (String(m.metricId).startsWith('finance.')) return true;
  if (isFinanceSource(m.source)) return true;
  if (valueIsFinance(m.value)) return true;
  if (
    valueIsFinance(m.comparison?.current) ||
    valueIsFinance(m.comparison?.previous)
  ) {
    return true;
  }
  if ((m.series ?? []).some((p) => valueIsFinance(p.value))) return true;
  return (m.rows ?? []).some(
    (r) => isFinanceSource(r.source) || valueIsFinance(r.value),
  );
}

/** Exception codes that expose money even outside the finance domain (explicit list, no pattern matching). */
const FINANCE_EXCEPTION_CODES: ReadonlySet<string> = new Set<string>([]);
/** Data-quality note keys that talk about costs; dropped from finance-free copies. */
const FINANCE_DQ_NOTES: ReadonlySet<string> = new Set([
  'reports.dq.unknown_costs',
  'reports.dq.partial_costs',
]);

const exceptionIsFinance = (e: {
  domain: string;
  code: string;
  messageKey?: string;
}): boolean =>
  e.domain === 'finance' ||
  FINANCE_EXCEPTION_CODES.has(e.code) ||
  e.code.startsWith('finance.') ||
  !!e.messageKey?.startsWith('reports.exception.finance.');

/* -------------------------------- helpers ------------------------------- */

function cardOf(m: MetricResult): KpiCard {
  const f = formatValue(m.value);
  const card: KpiCard = {
    id: m.metricId,
    label: metricLabel(m.metricId),
    valueText: f.text,
    unitText: f.unit,
    state: f.state,
  };
  if (f.detail) card.detail = f.detail;
  const src = sourceLabel(m.source);
  if (src) card.sourceLabel = src;
  if (m.comparison && f.state === 'value') {
    card.delta = formatPercentChange(m.comparison.percentChange);
  }
  return card;
}

/** Plain code-unit comparison (locale independent, deterministic). */
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const isCowKeyed = (metricId: string): boolean =>
  (COW_KEYED_ROW_METRIC_IDS as readonly string[]).includes(metricId);

/** A null label means a removed animal ONLY on cattle-keyed metrics; elsewhere the key is humanised. */
const rowLabel = (r: BreakdownRow, cowKeyed: boolean): string =>
  clampText(r.label ?? (cowKeyed ? 'Animal (removed)' : humanize(r.key)), 40);

const isDateKey = (k: string): boolean => parseYmd(k) !== null;

function makeTable(columns: TableColumn[], rows: string[][]): TableSpec {
  const spec: TableSpec = {
    columns,
    rows: rows.slice(0, MAX_TABLE_ROWS),
    repeatHeader: true,
    minRowsBeforeBreak: 3,
    avoidOrphanRows: 2,
  };
  if (rows.length > MAX_TABLE_ROWS) {
    spec.note = `Showing first ${formatNumber(MAX_TABLE_ROWS)} of ${formatNumber(rows.length)} rows.`;
  }
  return spec;
}

function rankedRows(
  rows: BreakdownRow[],
  keepOrder: boolean,
  cowKeyed: boolean,
): RankedRow[] {
  const vals = rows.filter(
    (
      r,
    ): r is BreakdownRow & {
      value: { state: 'value'; value: number; unit: string };
    } => r.value.state === 'value',
  );
  const sorted = keepOrder
    ? vals
    : [...vals].sort(
        (x, y) =>
          y.value.value - x.value.value ||
          cmp(rowLabel(x, cowKeyed), rowLabel(y, cowKeyed)),
      );
  return sorted.slice(0, TOP_N).map((r, i) => ({
    rank: i + 1,
    label: rowLabel(r, cowKeyed),
    value: r.value.value,
    text: formatFull(r.value),
  }));
}

function missingNote(rows: BreakdownRow[]): string | undefined {
  const n = rows.filter((r) => r.value.state !== 'value').length;
  return n > 0
    ? `${formatNumber(n)} ${n === 1 ? 'entry has' : 'entries have'} no record in this period (shown as ${TEXT_MISSING.toLowerCase()}, not zero).`
    : undefined;
}

/* ---------------------------- per-cow milk table ------------------------ */

function cowTable(metrics: MetricResult[]): {
  ranked: RankedRow[];
  rankedTitle: string;
  unitLabel: string;
  footnote?: string;
  table: TableSpec;
  total: number;
} | null {
  const byId = new Map(metrics.map((m) => [m.metricId as string, m]));
  const total = byId.get('milk.cow_total_yield');
  const cols = [
    'milk.cow_total_yield',
    'milk.cow_avg_daily_yield',
    'milk.cow_recorded_days',
    'milk.cow_expected_days',
  ].filter((id) => byId.has(id));
  if (!total || !total.rows || total.rows.length === 0) return null;

  const maps = cols.map((id) => {
    const m = new Map<string, BreakdownRow>();
    for (const r of byId.get(id)?.rows ?? []) m.set(r.key, r);
    return m;
  });
  const keys = new Map<string, BreakdownRow>();
  for (const r of total.rows) keys.set(r.key, r);

  const ordered = [...keys.values()].sort((a, b) => {
    const av = a.value.state === 'value' ? a.value.value : -Infinity;
    const bv = b.value.state === 'value' ? b.value.value : -Infinity;
    return bv - av || cmp(rowLabel(a, true), rowLabel(b, true));
  });

  const unitOf = (id: string): string => {
    const first = byId.get(id)?.rows?.find((r) => r.value.state === 'value');
    return first && first.value.state === 'value' ? first.value.unit : '';
  };
  const SHORT_HEAD: Record<string, string> = {
    'milk.cow_total_yield': 'Total',
    'milk.cow_avg_daily_yield': 'Avg per day',
    'milk.cow_recorded_days': 'Recorded days',
    'milk.cow_expected_days': 'Expected days',
  };
  const head = (id: string): string => {
    const u = unitOf(id);
    const l = SHORT_HEAD[id] ?? metricLabel(id);
    return u && u !== 'days' ? `${l} (${u})` : l;
  };
  const columns: TableColumn[] = [
    { label: '#', align: 'left', weight: 0.5 },
    { label: 'Animal', align: 'left', weight: 2.2 },
    ...cols.map((id) => ({
      label: head(id),
      align: 'right' as const,
      weight: 1.4,
    })),
  ];
  const rows = ordered.map((r, i) => [
    String(i + 1),
    rowLabel(r, true),
    ...cols.map((id, ci) => {
      const row = maps[ci].get(r.key);
      return row ? formatFull(row.value) : TEXT_MISSING;
    }),
  ]);
  return {
    ranked: rankedRows(total.rows, false, true),
    rankedTitle:
      total.rows.length > TOP_N
        ? `Top ${TOP_N} by ${metricLabel(total.metricId).toLowerCase()}`
        : metricLabel(total.metricId),
    unitLabel: unitOf('milk.cow_total_yield'),
    footnote: missingNote(total.rows),
    table: makeTable(columns, rows),
    total: total.rows.length,
  };
}

/* ------------------------------- sections ------------------------------- */

type ValuedRow = BreakdownRow & {
  value: { state: 'value'; value: number; unit: string };
};

function donutBlock(
  m: MetricResult,
  rows: BreakdownRow[],
  valued: BreakdownRow[],
): Extract<LayoutBlock, { type: 'donut' }> {
  const positive = valued.filter(
    (r): r is ValuedRow => r.value.state === 'value' && r.value.value > 0,
  );
  const sum = positive.reduce((t, r) => t + r.value.value, 0);
  const unit = positive[0]?.value.unit ?? '';
  const pct = (v: number): string =>
    sum > 0 ? ` · ${Math.round((v / sum) * 100)}%` : '';
  let ordered = positive;
  let other: { count: number; value: number } | null = null;
  if (positive.length > DONUT_MAX_SLICES) {
    ordered = [...positive].sort(
      (a, b) =>
        b.value.value - a.value.value ||
        cmp(humanize(a.label ?? a.key), humanize(b.label ?? b.key)),
    );
    const rest = ordered.slice(DONUT_MAX_SLICES - 1);
    ordered = ordered.slice(0, DONUT_MAX_SLICES - 1);
    other = {
      count: rest.length,
      value: rest.reduce((t, r) => t + r.value.value, 0),
    };
  }
  const slices = ordered.map((r) => ({
    label: humanize(r.label ?? r.key),
    value: r.value.value,
    text: formatFull(r.value) + pct(r.value.value),
  }));
  if (other) {
    slices.push({
      label: `Other (${formatNumber(other.count)})`,
      value: other.value,
      text:
        formatFull({ state: 'value', value: other.value, unit }) +
        pct(other.value),
    });
  }
  const block: Extract<LayoutBlock, { type: 'donut' }> = {
    type: 'donut',
    title: metricLabel(m.metricId),
    centerText: formatFull(m.value),
    centerCaption: 'total',
    slices,
  };
  const note = missingNote(rows);
  if (note) block.footnote = note;
  return block;
}

function blocksForSection(
  section: SnapshotSection,
  metrics: MetricResult[],
  heroId: string | null,
): LayoutBlock[] {
  const out: LayoutBlock[] = [];
  const title = keyLabel(section.titleKey) || metricLabel(section.id);
  out.push({ type: 'section', title });

  // Scalar cards: plain scalars; a series of fewer than 2 points (no chart is possible); and the own scalar
  // `value` of a charted metric (e.g. the total), which the chart does not print.
  const seriesLen = (m: MetricResult): number => m.series?.length ?? 0;
  const scalars = metrics.filter((m) => {
    if (m.metricId === heroId) return false;
    if (m.rows && m.rows.length) return false;
    if (PER_COW_MILK.test(m.metricId)) return false;
    const n = seriesLen(m);
    if (n === 0 || n === 1) return true;
    return m.value.state === 'value';
  });
  if (scalars.length) {
    out.push({
      type: 'kpis',
      cards: scalars.map((m) => {
        const only = m.series?.length === 1 ? m.series[0] : undefined;
        // A one-point series stands in for a scalar value that is absent.
        return cardOf(
          only && m.value.state !== 'value' && only.value.state === 'value'
            ? { ...m, value: only.value }
            : m,
        );
      }),
    });
  }

  for (const m of metrics) {
    if (m.series && m.series.length >= 2) {
      const pts: ChartPoint[] = m.series.map((p) => ({
        label: isDateKey(p.key) ? shortDate(p.key) : clampText(p.key, 16),
        value: p.value.state === 'value' ? p.value.value : null,
        text: formatFull(p.value),
      }));
      const unit = m.series.find((p) => p.value.state === 'value');
      const gaps = m.series.filter((p) => p.value.state !== 'value').length;
      const dated = m.series.every((p) => isDateKey(p.key));
      out.push({
        type: dated ? 'line' : 'bar',
        title: metricLabel(m.metricId),
        unitLabel: unit && unit.value.state === 'value' ? unit.value.unit : '',
        points: pts,
        footnote: gaps
          ? `${gaps} ${dated ? (gaps === 1 ? 'day has' : 'days have') : gaps === 1 ? 'entry has' : 'entries have'} no record (a gap, not zero).`
          : undefined,
      });
    }
  }

  const cows = cowTable(metrics);
  if (cows) {
    out.push({
      type: 'ranked',
      title: cows.rankedTitle,
      unitLabel: cows.unitLabel,
      rows: cows.ranked,
      footnote: cows.footnote,
      table: makeTable(cows.table.columns, cows.table.rows.slice(0, TOP_N)),
    });
    if (cows.total > TOP_N) {
      out.push({ type: 'table', title: 'All animals', table: cows.table });
    }
  }

  for (const m of metrics) {
    if (PER_COW_MILK.test(m.metricId)) continue;
    const rows = m.rows ?? [];
    if (!rows.length) continue;
    const valued = rows.filter((r) => r.value.state === 'value');
    if (DONUT_METRICS.has(m.metricId) && valued.length >= 1) {
      out.push(donutBlock(m, rows, valued));
      continue;
    }
    const cowKeyed = isCowKeyed(m.metricId);
    const ranked = rankedRows(rows, PRE_RANKED.test(m.metricId), cowKeyed);
    const src = sourceLabel(m.source);
    out.push({
      type: 'ranked',
      title: metricLabel(m.metricId) + (src ? ` · ${src}` : ''),
      unitLabel:
        valued[0] && valued[0].value.state === 'value'
          ? valued[0].value.unit
          : '',
      rows: ranked,
      footnote:
        [src ? `Source: ${src}.` : '', missingNote(rows) ?? '']
          .filter(Boolean)
          .join(' ') || undefined,
    });
    if (rows.length > TOP_N && !PRE_RANKED.test(m.metricId)) {
      out.push({
        type: 'table',
        title: `${metricLabel(m.metricId)} · all entries`,
        table: makeTable(
          [
            { label: '#', align: 'left', weight: 0.5 },
            { label: 'Entry', align: 'left', weight: 2.4 },
            { label: metricLabel(m.metricId), align: 'right', weight: 1.6 },
          ],
          [...rows]
            .sort(
              (a, b) =>
                (b.value.state === 'value' ? b.value.value : -Infinity) -
                  (a.value.state === 'value' ? a.value.value : -Infinity) ||
                cmp(rowLabel(a, cowKeyed), rowLabel(b, cowKeyed)),
            )
            .map((r, i) => [
              String(i + 1),
              rowLabel(r, cowKeyed),
              formatFull(r.value),
            ]),
        ),
      });
    }
  }
  return out;
}

/* --------------------------------- main --------------------------------- */

function scopeText(p: ReportSnapshotPayload): string {
  switch (p.scope.kind) {
    case 'SINGLE_COW':
      return 'One animal';
    case 'GROUP':
      return `Group, members as of ${formatInstant(p.scope.membershipAsOf, p.farm.timezone)}`;
    default:
      return 'All eligible animals';
  }
}

export function buildReportLayout(
  payload: ReportSnapshotPayload,
): ReportLayout {
  const kind: ReportKind = payload.reportType
    ? KIND_BY_TYPE[payload.reportType]
    : detectKind(payload.period);
  const a = parseYmd(payload.period.startDate);
  const range = formatRange(payload.period.startDate, payload.period.endDate);
  const days = daysBetweenInclusive(
    payload.period.startDate,
    payload.period.endDate,
  );

  let title: string;
  let eyebrow: string;
  let headerRight: string[];
  let footerType: string;
  if (kind === 'weekly') {
    title = 'Weekly farm report';
    eyebrow = `WEEKLY REPORT · ${range.toUpperCase()}`;
    headerRight = ['WEEKLY FIELD REPORT', range.toUpperCase()];
    footerType = 'Weekly report';
  } else if (kind === 'monthly' && a) {
    title = `${monthName(a.m)} at a glance`;
    eyebrow = `MANAGEMENT REVIEW · ${monthName(a.m).toUpperCase()} ${a.y}`;
    headerRight = [
      'MONTHLY MANAGEMENT REVIEW',
      `${monthName(a.m).toUpperCase()} ${a.y}`,
    ];
    footerType = 'Monthly review';
  } else {
    title = 'Farm snapshot';
    eyebrow = 'ON-DEMAND REPORT';
    headerRight = ['ON-DEMAND FARM SNAPSHOT', range.toUpperCase()];
    footerType = 'On-demand snapshot';
  }

  const includeFinance = payload.includesFinance;
  const sections = payload.sections
    .filter((s) => includeFinance || s.domain !== 'finance')
    .map((s) => ({
      section: s,
      metrics: includeFinance
        ? s.metrics
        : s.metrics.filter((m) => !metricIsFinance(m)),
    }))
    // A section whose metrics were all removed as finance is dropped, not left as an empty heading.
    .filter(
      ({ section, metrics }) =>
        includeFinance || metrics.length > 0 || section.metrics.length === 0,
    );

  const meta: { label: string; value: string }[] = [
    {
      label: 'Period',
      value: `${range}${days ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}`,
    },
    {
      label: 'Generated',
      value: formatInstant(payload.generatedAt, payload.farm.timezone),
    },
  ];
  if (includeFinance) meta.push({ label: 'Currency', value: 'BDT (৳)' });
  meta.push({ label: 'Scope', value: scopeText(payload) });

  const blocks: LayoutBlock[] = [];

  // Hero: milk total when present, otherwise the first scalar metric of the first section.
  const allMetrics = sections.flatMap((s) => s.metrics);
  const heroMetric =
    allMetrics.find((m) => m.metricId === 'milk.total_yield') ??
    allMetrics.find(
      (m) => !(m.rows && m.rows.length) && !(m.series && m.series.length),
    );
  if (heroMetric) {
    const f = formatValue(heroMetric.value);
    const prev = payload.previousPeriod;
    blocks.push({
      type: 'hero',
      eyebrow: metricLabel(heroMetric.metricId).toUpperCase(),
      valueText: f.text,
      unitText: f.unit,
      state: f.state,
      delta:
        heroMetric.comparison && f.state === 'value'
          ? formatPercentChange(heroMetric.comparison.percentChange)
          : undefined,
      caption: heroMetric.comparison
        ? prev
          ? `vs ${formatRange(prev.startDate, prev.endDate)}`
          : 'vs previous period'
        : (f.detail ?? sourceLabel(heroMetric.source) ?? undefined),
      sideLabel: 'REPORT PERIOD',
      sideLines: [
        range,
        ...(prev
          ? [`Compared with ${formatRange(prev.startDate, prev.endDate)}`]
          : []),
      ],
    });
  }

  for (const { section, metrics } of sections) {
    blocks.push(
      ...blocksForSection(section, metrics, heroMetric?.metricId ?? null),
    );
  }

  const exceptions = payload.exceptions.filter(
    (e) => includeFinance || !exceptionIsFinance(e),
  );
  if (exceptions.length) {
    blocks.push({
      type: 'exceptions',
      title: 'Needs attention',
      items: exceptions.map((e) => ({
        text: keyLabel(e.messageKey || e.code) || keyLabel(e.code),
        detail: e.cattleIds?.length
          ? `${formatNumber(e.cattleIds.length)} ${e.cattleIds.length === 1 ? 'animal' : 'animals'}`
          : undefined,
      })),
    });
  }

  if (!includeFinance) {
    blocks.push({
      type: 'notice',
      tone: 'restricted',
      title: 'FINANCE · RESTRICTED',
      text: 'This copy was created without finance access, so it contains no money figures. Open the report with an authorised account to see them.',
    });
  }

  const domains = new Set(sections.map((s) => s.section.domain));
  const rules = [
    'Missing is not zero: a day or animal with no record is shown as "Not recorded" and is never counted as 0.',
  ];
  if (domains.has('reproduction')) {
    rules.push(
      'Pending breeding outcomes are excluded from rates; they are not counted as failures.',
    );
  }
  if (domains.has('feed')) {
    rules.push(
      'Recorded feed is what was entered at the farm; offered minus refusal is a different figure and is not measured intake.',
    );
  }
  const dq = payload.dataQuality;
  const noteSet = new Set<string>();
  for (const n of dq.notes) {
    if (!includeFinance && FINANCE_DQ_NOTES.has(n)) continue;
    const t = keyLabel(n);
    if (t) noteSet.add(t);
  }
  const f = dq.flags;
  if (f.hasUnsubmittedDrafts)
    noteSet.add(keyLabel('reports.dq.unsubmitted_drafts_excluded'));
  if (f.hasEstimatedValues)
    noteSet.add(keyLabel('reports.dq.estimated_values'));
  if (f.incompleteCoverage)
    noteSet.add(keyLabel('reports.dq.incomplete_coverage'));
  if (f.groupMembershipCurrentOnly)
    noteSet.add(keyLabel('reports.dq.group_membership_as_of_generation'));
  if (f.hasUnknownCosts && includeFinance)
    noteSet.add(keyLabel('reports.dq.unknown_costs'));

  const { expected, recorded } = dq.coverage;
  blocks.push({
    type: 'dataQuality',
    title: 'Data quality',
    coverage:
      expected > 0
        ? `${formatNumber(recorded)} of ${formatNumber(expected)} expected entries recorded (${Math.floor((recorded * 100) / expected)}%).`
        : 'No entries were expected in this period.',
    rules,
    notes: [...noteSet],
  });

  return {
    kind,
    title,
    eyebrow,
    headerRight,
    farmName: clampText(payload.farm.name, 80),
    meta,
    footerLabel: `RAKHAL · ${footerType}`,
    blocks,
  };
}
