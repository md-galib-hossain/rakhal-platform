"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_TABLE_ROWS = exports.DONUT_MAX_SLICES = exports.TOP_N = void 0;
exports.detectKind = detectKind;
exports.buildReportLayout = buildReportLayout;
const snapshot_1 = require("../../domain/contracts/snapshot");
const report_compute_service_1 = require("../../application/pipeline/report-compute.service");
const report_format_1 = require("./report-format");
const report_labels_1 = require("./report-labels");
exports.TOP_N = 10;
exports.DONUT_MAX_SLICES = 8;
exports.MAX_TABLE_ROWS = 5000;
const DONUT_METRICS = new Set(['milk.disposition_yield']);
const PER_COW_MILK = /^milk\.cow_/;
const PRE_RANKED = /(^|\.)(top|bottom)_/;
const KIND_BY_TYPE = {
    WEEKLY: 'weekly',
    MONTHLY: 'monthly',
    ON_DEMAND: 'snapshot',
};
function detectKind(period) {
    const days = (0, report_format_1.daysBetweenInclusive)(period.startDate, period.endDate);
    const a = (0, report_format_1.parseYmd)(period.startDate);
    const b = (0, report_format_1.parseYmd)(period.endDate);
    if (!days || !a || !b)
        return 'snapshot';
    const dow = new Date(Date.UTC(a.y, a.m - 1, a.d)).getUTCDay();
    if (days === 7 && dow === 1)
        return 'weekly';
    const lastOfMonth = new Date(Date.UTC(b.y, b.m, 0)).getUTCDate();
    if (a.d === 1 && a.y === b.y && a.m === b.m && b.d === lastOfMonth) {
        return 'monthly';
    }
    return 'snapshot';
}
const isFinanceUnit = (u) => u === 'BDT' || u.startsWith('BDT/');
const isFinanceSource = (s) => !!s && (snapshot_1.FINANCE_SOURCE_DENYLIST.includes(s) || s.startsWith('ledger'));
const valueIsFinance = (v) => !!v && v.state === 'value' && isFinanceUnit(v.unit);
function metricIsFinance(m) {
    if (m.requiresPermission === 'finance.read')
        return true;
    if (String(m.metricId).startsWith('finance.'))
        return true;
    if (isFinanceSource(m.source))
        return true;
    if (valueIsFinance(m.value))
        return true;
    if (valueIsFinance(m.comparison?.current) ||
        valueIsFinance(m.comparison?.previous)) {
        return true;
    }
    if ((m.series ?? []).some((p) => valueIsFinance(p.value)))
        return true;
    return (m.rows ?? []).some((r) => isFinanceSource(r.source) || valueIsFinance(r.value));
}
const FINANCE_EXCEPTION_CODES = new Set([]);
const FINANCE_DQ_NOTES = new Set([
    'reports.dq.unknown_costs',
    'reports.dq.partial_costs',
]);
const exceptionIsFinance = (e) => e.domain === 'finance' ||
    FINANCE_EXCEPTION_CODES.has(e.code) ||
    e.code.startsWith('finance.') ||
    !!e.messageKey?.startsWith('reports.exception.finance.');
function cardOf(m) {
    const f = (0, report_format_1.formatValue)(m.value);
    const card = {
        id: m.metricId,
        label: (0, report_labels_1.metricLabel)(m.metricId),
        valueText: f.text,
        unitText: f.unit,
        state: f.state,
    };
    if (f.detail)
        card.detail = f.detail;
    const src = (0, report_labels_1.sourceLabel)(m.source);
    if (src)
        card.sourceLabel = src;
    if (m.comparison && f.state === 'value') {
        card.delta = (0, report_format_1.formatPercentChange)(m.comparison.percentChange);
    }
    return card;
}
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0);
const isCowKeyed = (metricId) => report_compute_service_1.COW_KEYED_ROW_METRIC_IDS.includes(metricId);
const rowLabel = (r, cowKeyed) => (0, report_format_1.clampText)(r.label ?? (cowKeyed ? 'Animal (removed)' : (0, report_labels_1.humanize)(r.key)), 40);
const isDateKey = (k) => (0, report_format_1.parseYmd)(k) !== null;
function makeTable(columns, rows) {
    const spec = {
        columns,
        rows: rows.slice(0, exports.MAX_TABLE_ROWS),
        repeatHeader: true,
        minRowsBeforeBreak: 3,
        avoidOrphanRows: 2,
    };
    if (rows.length > exports.MAX_TABLE_ROWS) {
        spec.note = `Showing first ${(0, report_format_1.formatNumber)(exports.MAX_TABLE_ROWS)} of ${(0, report_format_1.formatNumber)(rows.length)} rows.`;
    }
    return spec;
}
function rankedRows(rows, keepOrder, cowKeyed) {
    const vals = rows.filter((r) => r.value.state === 'value');
    const sorted = keepOrder
        ? vals
        : [...vals].sort((x, y) => y.value.value - x.value.value ||
            cmp(rowLabel(x, cowKeyed), rowLabel(y, cowKeyed)));
    return sorted.slice(0, exports.TOP_N).map((r, i) => ({
        rank: i + 1,
        label: rowLabel(r, cowKeyed),
        value: r.value.value,
        text: (0, report_format_1.formatFull)(r.value),
    }));
}
function missingNote(rows) {
    const n = rows.filter((r) => r.value.state !== 'value').length;
    return n > 0
        ? `${(0, report_format_1.formatNumber)(n)} ${n === 1 ? 'entry has' : 'entries have'} no record in this period (shown as ${report_format_1.TEXT_MISSING.toLowerCase()}, not zero).`
        : undefined;
}
function cowTable(metrics) {
    const byId = new Map(metrics.map((m) => [m.metricId, m]));
    const total = byId.get('milk.cow_total_yield');
    const cols = [
        'milk.cow_total_yield',
        'milk.cow_avg_daily_yield',
        'milk.cow_recorded_days',
        'milk.cow_expected_days',
    ].filter((id) => byId.has(id));
    if (!total || !total.rows || total.rows.length === 0)
        return null;
    const maps = cols.map((id) => {
        const m = new Map();
        for (const r of byId.get(id)?.rows ?? [])
            m.set(r.key, r);
        return m;
    });
    const keys = new Map();
    for (const r of total.rows)
        keys.set(r.key, r);
    const ordered = [...keys.values()].sort((a, b) => {
        const av = a.value.state === 'value' ? a.value.value : -Infinity;
        const bv = b.value.state === 'value' ? b.value.value : -Infinity;
        return bv - av || cmp(rowLabel(a, true), rowLabel(b, true));
    });
    const unitOf = (id) => {
        const first = byId.get(id)?.rows?.find((r) => r.value.state === 'value');
        return first && first.value.state === 'value' ? first.value.unit : '';
    };
    const SHORT_HEAD = {
        'milk.cow_total_yield': 'Total',
        'milk.cow_avg_daily_yield': 'Avg per day',
        'milk.cow_recorded_days': 'Recorded days',
        'milk.cow_expected_days': 'Expected days',
    };
    const head = (id) => {
        const u = unitOf(id);
        const l = SHORT_HEAD[id] ?? (0, report_labels_1.metricLabel)(id);
        return u && u !== 'days' ? `${l} (${u})` : l;
    };
    const columns = [
        { label: '#', align: 'left', weight: 0.5 },
        { label: 'Animal', align: 'left', weight: 2.2 },
        ...cols.map((id) => ({
            label: head(id),
            align: 'right',
            weight: 1.4,
        })),
    ];
    const rows = ordered.map((r, i) => [
        String(i + 1),
        rowLabel(r, true),
        ...cols.map((id, ci) => {
            const row = maps[ci].get(r.key);
            return row ? (0, report_format_1.formatFull)(row.value) : report_format_1.TEXT_MISSING;
        }),
    ]);
    return {
        ranked: rankedRows(total.rows, false, true),
        rankedTitle: total.rows.length > exports.TOP_N
            ? `Top ${exports.TOP_N} by ${(0, report_labels_1.metricLabel)(total.metricId).toLowerCase()}`
            : (0, report_labels_1.metricLabel)(total.metricId),
        unitLabel: unitOf('milk.cow_total_yield'),
        footnote: missingNote(total.rows),
        table: makeTable(columns, rows),
        total: total.rows.length,
    };
}
function donutBlock(m, rows, valued) {
    const positive = valued.filter((r) => r.value.state === 'value' && r.value.value > 0);
    const sum = positive.reduce((t, r) => t + r.value.value, 0);
    const unit = positive[0]?.value.unit ?? '';
    const pct = (v) => sum > 0 ? ` · ${Math.round((v / sum) * 100)}%` : '';
    let ordered = positive;
    let other = null;
    if (positive.length > exports.DONUT_MAX_SLICES) {
        ordered = [...positive].sort((a, b) => b.value.value - a.value.value ||
            cmp((0, report_labels_1.humanize)(a.label ?? a.key), (0, report_labels_1.humanize)(b.label ?? b.key)));
        const rest = ordered.slice(exports.DONUT_MAX_SLICES - 1);
        ordered = ordered.slice(0, exports.DONUT_MAX_SLICES - 1);
        other = {
            count: rest.length,
            value: rest.reduce((t, r) => t + r.value.value, 0),
        };
    }
    const slices = ordered.map((r) => ({
        label: (0, report_labels_1.humanize)(r.label ?? r.key),
        value: r.value.value,
        text: (0, report_format_1.formatFull)(r.value) + pct(r.value.value),
    }));
    if (other) {
        slices.push({
            label: `Other (${(0, report_format_1.formatNumber)(other.count)})`,
            value: other.value,
            text: (0, report_format_1.formatFull)({ state: 'value', value: other.value, unit }) +
                pct(other.value),
        });
    }
    const block = {
        type: 'donut',
        title: (0, report_labels_1.metricLabel)(m.metricId),
        centerText: (0, report_format_1.formatFull)(m.value),
        centerCaption: 'total',
        slices,
    };
    const note = missingNote(rows);
    if (note)
        block.footnote = note;
    return block;
}
function blocksForSection(section, metrics, heroId) {
    const out = [];
    const title = (0, report_labels_1.keyLabel)(section.titleKey) || (0, report_labels_1.metricLabel)(section.id);
    out.push({ type: 'section', title });
    const seriesLen = (m) => m.series?.length ?? 0;
    const scalars = metrics.filter((m) => {
        if (m.metricId === heroId)
            return false;
        if (m.rows && m.rows.length)
            return false;
        if (PER_COW_MILK.test(m.metricId))
            return false;
        const n = seriesLen(m);
        if (n === 0 || n === 1)
            return true;
        return m.value.state === 'value';
    });
    if (scalars.length) {
        out.push({
            type: 'kpis',
            cards: scalars.map((m) => {
                const only = m.series?.length === 1 ? m.series[0] : undefined;
                return cardOf(only && m.value.state !== 'value' && only.value.state === 'value'
                    ? { ...m, value: only.value }
                    : m);
            }),
        });
    }
    for (const m of metrics) {
        if (m.series && m.series.length >= 2) {
            const pts = m.series.map((p) => ({
                label: isDateKey(p.key) ? (0, report_format_1.shortDate)(p.key) : (0, report_format_1.clampText)(p.key, 16),
                value: p.value.state === 'value' ? p.value.value : null,
                text: (0, report_format_1.formatFull)(p.value),
            }));
            const unit = m.series.find((p) => p.value.state === 'value');
            const gaps = m.series.filter((p) => p.value.state !== 'value').length;
            const dated = m.series.every((p) => isDateKey(p.key));
            out.push({
                type: dated ? 'line' : 'bar',
                title: (0, report_labels_1.metricLabel)(m.metricId),
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
            table: makeTable(cows.table.columns, cows.table.rows.slice(0, exports.TOP_N)),
        });
        if (cows.total > exports.TOP_N) {
            out.push({ type: 'table', title: 'All animals', table: cows.table });
        }
    }
    for (const m of metrics) {
        if (PER_COW_MILK.test(m.metricId))
            continue;
        const rows = m.rows ?? [];
        if (!rows.length)
            continue;
        const valued = rows.filter((r) => r.value.state === 'value');
        if (DONUT_METRICS.has(m.metricId) && valued.length >= 1) {
            out.push(donutBlock(m, rows, valued));
            continue;
        }
        const cowKeyed = isCowKeyed(m.metricId);
        const ranked = rankedRows(rows, PRE_RANKED.test(m.metricId), cowKeyed);
        const src = (0, report_labels_1.sourceLabel)(m.source);
        out.push({
            type: 'ranked',
            title: (0, report_labels_1.metricLabel)(m.metricId) + (src ? ` · ${src}` : ''),
            unitLabel: valued[0] && valued[0].value.state === 'value'
                ? valued[0].value.unit
                : '',
            rows: ranked,
            footnote: [src ? `Source: ${src}.` : '', missingNote(rows) ?? '']
                .filter(Boolean)
                .join(' ') || undefined,
        });
        if (rows.length > exports.TOP_N && !PRE_RANKED.test(m.metricId)) {
            out.push({
                type: 'table',
                title: `${(0, report_labels_1.metricLabel)(m.metricId)} · all entries`,
                table: makeTable([
                    { label: '#', align: 'left', weight: 0.5 },
                    { label: 'Entry', align: 'left', weight: 2.4 },
                    { label: (0, report_labels_1.metricLabel)(m.metricId), align: 'right', weight: 1.6 },
                ], [...rows]
                    .sort((a, b) => (b.value.state === 'value' ? b.value.value : -Infinity) -
                    (a.value.state === 'value' ? a.value.value : -Infinity) ||
                    cmp(rowLabel(a, cowKeyed), rowLabel(b, cowKeyed)))
                    .map((r, i) => [
                    String(i + 1),
                    rowLabel(r, cowKeyed),
                    (0, report_format_1.formatFull)(r.value),
                ])),
            });
        }
    }
    return out;
}
function scopeText(p) {
    switch (p.scope.kind) {
        case 'SINGLE_COW':
            return 'One animal';
        case 'GROUP':
            return `Group, members as of ${(0, report_format_1.formatInstant)(p.scope.membershipAsOf, p.farm.timezone)}`;
        default:
            return 'All eligible animals';
    }
}
function buildReportLayout(payload) {
    const kind = payload.reportType
        ? KIND_BY_TYPE[payload.reportType]
        : detectKind(payload.period);
    const a = (0, report_format_1.parseYmd)(payload.period.startDate);
    const range = (0, report_format_1.formatRange)(payload.period.startDate, payload.period.endDate);
    const days = (0, report_format_1.daysBetweenInclusive)(payload.period.startDate, payload.period.endDate);
    let title;
    let eyebrow;
    let headerRight;
    let footerType;
    if (kind === 'weekly') {
        title = 'Weekly farm report';
        eyebrow = `WEEKLY REPORT · ${range.toUpperCase()}`;
        headerRight = ['WEEKLY FIELD REPORT', range.toUpperCase()];
        footerType = 'Weekly report';
    }
    else if (kind === 'monthly' && a) {
        title = `${(0, report_format_1.monthName)(a.m)} at a glance`;
        eyebrow = `MANAGEMENT REVIEW · ${(0, report_format_1.monthName)(a.m).toUpperCase()} ${a.y}`;
        headerRight = [
            'MONTHLY MANAGEMENT REVIEW',
            `${(0, report_format_1.monthName)(a.m).toUpperCase()} ${a.y}`,
        ];
        footerType = 'Monthly review';
    }
    else {
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
        .filter(({ section, metrics }) => includeFinance || metrics.length > 0 || section.metrics.length === 0);
    const meta = [
        {
            label: 'Period',
            value: `${range}${days ? ` · ${days} ${days === 1 ? 'day' : 'days'}` : ''}`,
        },
        {
            label: 'Generated',
            value: (0, report_format_1.formatInstant)(payload.generatedAt, payload.farm.timezone),
        },
    ];
    if (includeFinance)
        meta.push({ label: 'Currency', value: 'BDT (৳)' });
    meta.push({ label: 'Scope', value: scopeText(payload) });
    const blocks = [];
    const allMetrics = sections.flatMap((s) => s.metrics);
    const heroMetric = allMetrics.find((m) => m.metricId === 'milk.total_yield') ??
        allMetrics.find((m) => !(m.rows && m.rows.length) && !(m.series && m.series.length));
    if (heroMetric) {
        const f = (0, report_format_1.formatValue)(heroMetric.value);
        const prev = payload.previousPeriod;
        blocks.push({
            type: 'hero',
            eyebrow: (0, report_labels_1.metricLabel)(heroMetric.metricId).toUpperCase(),
            valueText: f.text,
            unitText: f.unit,
            state: f.state,
            delta: heroMetric.comparison && f.state === 'value'
                ? (0, report_format_1.formatPercentChange)(heroMetric.comparison.percentChange)
                : undefined,
            caption: heroMetric.comparison
                ? prev
                    ? `vs ${(0, report_format_1.formatRange)(prev.startDate, prev.endDate)}`
                    : 'vs previous period'
                : (f.detail ?? (0, report_labels_1.sourceLabel)(heroMetric.source) ?? undefined),
            sideLabel: 'REPORT PERIOD',
            sideLines: [
                range,
                ...(prev
                    ? [`Compared with ${(0, report_format_1.formatRange)(prev.startDate, prev.endDate)}`]
                    : []),
            ],
        });
    }
    for (const { section, metrics } of sections) {
        blocks.push(...blocksForSection(section, metrics, heroMetric?.metricId ?? null));
    }
    const exceptions = payload.exceptions.filter((e) => includeFinance || !exceptionIsFinance(e));
    if (exceptions.length) {
        blocks.push({
            type: 'exceptions',
            title: 'Needs attention',
            items: exceptions.map((e) => ({
                text: (0, report_labels_1.keyLabel)(e.messageKey || e.code) || (0, report_labels_1.keyLabel)(e.code),
                detail: e.cattleIds?.length
                    ? `${(0, report_format_1.formatNumber)(e.cattleIds.length)} ${e.cattleIds.length === 1 ? 'animal' : 'animals'}`
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
        rules.push('Pending breeding outcomes are excluded from rates; they are not counted as failures.');
    }
    if (domains.has('feed')) {
        rules.push('Recorded feed is what was entered at the farm; offered minus refusal is a different figure and is not measured intake.');
    }
    const dq = payload.dataQuality;
    const noteSet = new Set();
    for (const n of dq.notes) {
        if (!includeFinance && FINANCE_DQ_NOTES.has(n))
            continue;
        const t = (0, report_labels_1.keyLabel)(n);
        if (t)
            noteSet.add(t);
    }
    const f = dq.flags;
    if (f.hasUnsubmittedDrafts)
        noteSet.add((0, report_labels_1.keyLabel)('reports.dq.unsubmitted_drafts_excluded'));
    if (f.hasEstimatedValues)
        noteSet.add((0, report_labels_1.keyLabel)('reports.dq.estimated_values'));
    if (f.incompleteCoverage)
        noteSet.add((0, report_labels_1.keyLabel)('reports.dq.incomplete_coverage'));
    if (f.groupMembershipCurrentOnly)
        noteSet.add((0, report_labels_1.keyLabel)('reports.dq.group_membership_as_of_generation'));
    if (f.hasUnknownCosts && includeFinance)
        noteSet.add((0, report_labels_1.keyLabel)('reports.dq.unknown_costs'));
    const { expected, recorded } = dq.coverage;
    blocks.push({
        type: 'dataQuality',
        title: 'Data quality',
        coverage: expected > 0
            ? `${(0, report_format_1.formatNumber)(recorded)} of ${(0, report_format_1.formatNumber)(expected)} expected entries recorded (${Math.floor((recorded * 100) / expected)}%).`
            : 'No entries were expected in this period.',
        rules,
        notes: [...noteSet],
    });
    return {
        kind,
        title,
        eyebrow,
        headerRight,
        farmName: (0, report_format_1.clampText)(payload.farm.name, 80),
        meta,
        footerLabel: `RAKHAL · ${footerType}`,
        blocks,
    };
}
//# sourceMappingURL=report-layout.js.map