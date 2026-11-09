"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monthName = exports.TAKA = exports.TEXT_NOT_APPLICABLE = exports.TEXT_NOT_CALCULATED = exports.TEXT_MISSING = void 0;
exports.formatNumber = formatNumber;
exports.formatValue = formatValue;
exports.formatFull = formatFull;
exports.formatPercentChange = formatPercentChange;
exports.parseYmd = parseYmd;
exports.shortDate = shortDate;
exports.formatRange = formatRange;
exports.daysBetweenInclusive = daysBetweenInclusive;
exports.formatInstant = formatInstant;
exports.stripControl = stripControl;
exports.clampText = clampText;
const report_labels_1 = require("./report-labels");
exports.TEXT_MISSING = 'Not recorded';
exports.TEXT_NOT_CALCULATED = 'Not calculated';
exports.TEXT_NOT_APPLICABLE = '—';
exports.TAKA = '৳';
const NF = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
    useGrouping: true,
});
function formatNumber(n) {
    if (!Number.isFinite(n))
        return exports.TEXT_NOT_APPLICABLE;
    const s = NF.format(n);
    return s === '-0' ? '0' : s;
}
const COUNT_UNITS = new Set(['count', 'cows', 'items', '']);
function formatValue(v) {
    switch (v.state) {
        case 'value': {
            const num = formatNumber(v.value);
            const unit = v.unit;
            if (unit === 'BDT')
                return { state: 'value', text: `${exports.TAKA}${num}`, unit: '' };
            if (unit.startsWith('BDT/')) {
                return {
                    state: 'value',
                    text: `${exports.TAKA}${num}`,
                    unit: `/ ${unit.slice(4)}`,
                };
            }
            if (unit === '%')
                return { state: 'value', text: `${num}%`, unit: '' };
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
                text: exports.TEXT_MISSING,
                unit: '',
                detail: v.reason ? (0, report_labels_1.keyLabel)(v.reason) : undefined,
            };
        case 'not_calculated':
            return {
                state: 'not_calculated',
                text: exports.TEXT_NOT_CALCULATED,
                unit: '',
                detail: v.reason ? (0, report_labels_1.keyLabel)(v.reason) : undefined,
            };
        default:
            return { state: 'not_applicable', text: exports.TEXT_NOT_APPLICABLE, unit: '' };
    }
}
function formatFull(v) {
    const f = formatValue(v);
    return f.unit ? `${f.text} ${f.unit}` : f.text;
}
function formatPercentChange(pct) {
    if (pct === null || !Number.isFinite(pct)) {
        return { text: exports.TEXT_NOT_APPLICABLE, direction: 'none' };
    }
    const rounded = Math.round(pct * 10) / 10;
    if (rounded === 0)
        return { text: '0.0%', direction: 'flat' };
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
const monthName = (m1) => MONTHS[m1 - 1] ?? '';
exports.monthName = monthName;
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function parseYmd(s) {
    const m = DATE_RE.exec(s);
    return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}
function shortDate(s) {
    const p = parseYmd(s);
    return p ? `${p.d} ${(0, exports.monthName)(p.m).slice(0, 3)}` : s;
}
function formatRange(start, end) {
    const a = parseYmd(start);
    const b = parseYmd(end);
    if (!a || !b)
        return `${start} – ${end}`;
    if (start === end)
        return `${a.d} ${(0, exports.monthName)(a.m)} ${a.y}`;
    if (a.y === b.y && a.m === b.m) {
        return `${a.d}–${b.d} ${(0, exports.monthName)(b.m)} ${b.y}`;
    }
    if (a.y === b.y) {
        return `${a.d} ${(0, exports.monthName)(a.m).slice(0, 3)} – ${b.d} ${(0, exports.monthName)(b.m).slice(0, 3)} ${b.y}`;
    }
    return `${a.d} ${(0, exports.monthName)(a.m).slice(0, 3)} ${a.y} – ${b.d} ${(0, exports.monthName)(b.m).slice(0, 3)} ${b.y}`;
}
function daysBetweenInclusive(start, end) {
    const a = parseYmd(start);
    const b = parseYmd(end);
    if (!a || !b)
        return null;
    return (Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000) + 1);
}
function formatInstant(iso, timeZone) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime()))
        return iso;
    const make = (tz) => new Intl.DateTimeFormat('en-GB', {
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
    }
    catch {
        return `${make('UTC')} UTC`;
    }
}
function stripControl(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
        const c = s.charCodeAt(i);
        out += c < 32 || c === 127 ? ' ' : s[i];
    }
    return out;
}
function clampText(s, max = 120) {
    const t = stripControl((0, report_labels_1.asText)(s)).trim();
    return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}
//# sourceMappingURL=report-format.js.map