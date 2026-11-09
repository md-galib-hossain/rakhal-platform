"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MAX_CUSTOM_RANGE_DAYS = void 0;
exports.resolvePreset = resolvePreset;
exports.closedPeriodFor = closedPeriodFor;
exports.detectPeriodKind = detectPeriodKind;
exports.previousEquivalentPeriod = previousEquivalentPeriod;
exports.scheduledRunInstant = scheduledRunInstant;
exports.enumerateDays = enumerateDays;
const farm_time_1 = require("../../../../common/farm-time/farm-time");
const health_farm_day_1 = require("../../../health/domain/health-farm-day");
const errors_1 = require("./errors");
const ymd_1 = require("./ymd");
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
exports.MAX_CUSTOM_RANGE_DAYS = 366;
function assertTimezone(timezone) {
    if (!timezone || !(0, farm_time_1.isValidTimezone)(timezone)) {
        throw new errors_1.InvalidTimezoneError(timezone);
    }
}
function build(startDate, endDate, timezone, label) {
    return {
        start: (0, health_farm_day_1.farmDayStart)(startDate, timezone).toISOString(),
        end: (0, health_farm_day_1.farmDayEnd)(endDate, timezone).toISOString(),
        startDate,
        endDate,
        timezone,
        label,
    };
}
const weekLabel = (monday) => {
    const { year, week } = (0, ymd_1.isoWeekOf)(monday);
    return `${year}-W${String(week).padStart(2, '0')}`;
};
function weekPeriod(monday, timezone) {
    return build(monday, (0, ymd_1.addDaysYmd)(monday, 6), timezone, weekLabel(monday));
}
function monthPeriod(y, m, timezone) {
    return build((0, ymd_1.makeYmd)(y, m, 1), (0, ymd_1.makeYmd)(y, m, (0, ymd_1.daysInMonth)(y, m)), timezone, `${MONTHS[m - 1]} ${y}`);
}
function yearPeriod(y, timezone) {
    return build(`${y}-01-01`, `${y}-12-31`, timezone, String(y));
}
function resolvePreset(preset, nowInstant, timezone, custom) {
    assertTimezone(timezone);
    const today = (0, farm_time_1.localDateIso)(timezone, nowInstant);
    switch (preset) {
        case 'today':
            return build(today, today, timezone, today);
        case 'this_week':
            return weekPeriod((0, ymd_1.mondayOf)(today), timezone);
        case 'this_month': {
            const { y, m } = (0, ymd_1.parseYmd)(today);
            return monthPeriod(y, m, timezone);
        }
        case 'this_year':
            return yearPeriod((0, ymd_1.parseYmd)(today).y, timezone);
        case 'custom': {
            if (!custom)
                throw new errors_1.InvalidPresetError('custom preset needs from/to');
            const from = (0, ymd_1.assertYmd)(custom.from);
            const to = (0, ymd_1.assertYmd)(custom.to);
            if (from > to)
                throw new errors_1.InvalidRangeError(from, to);
            const span = (0, ymd_1.diffDaysYmd)(from, to) + 1;
            if (span > exports.MAX_CUSTOM_RANGE_DAYS)
                throw new errors_1.RangeTooLongError(span, exports.MAX_CUSTOM_RANGE_DAYS);
            return build(from, to, timezone, from === to ? from : `${from} - ${to}`);
        }
        default:
            throw new errors_1.InvalidPresetError(`Unknown preset: ${String(preset)}`);
    }
}
function closedPeriodFor(type, nowInstant, timezone) {
    assertTimezone(timezone);
    const today = (0, farm_time_1.localDateIso)(timezone, nowInstant);
    if (type === 'WEEKLY') {
        return weekPeriod((0, ymd_1.addDaysYmd)((0, ymd_1.mondayOf)(today), -7), timezone);
    }
    if (type === 'MONTHLY') {
        const { y, m } = (0, ymd_1.parseYmd)(today);
        return m === 1
            ? monthPeriod(y - 1, 12, timezone)
            : monthPeriod(y, m - 1, timezone);
    }
    throw new errors_1.InvalidPresetError(`No closed period for type: ${String(type)}`);
}
function detectPeriodKind(period) {
    const { startDate: s, endDate: e } = period;
    if (s === e)
        return 'day';
    const a = (0, ymd_1.parseYmd)(s);
    const b = (0, ymd_1.parseYmd)(e);
    if (a.y === b.y && a.m === 1 && a.d === 1 && b.m === 12 && b.d === 31) {
        return 'year';
    }
    if (a.y === b.y &&
        a.m === b.m &&
        a.d === 1 &&
        b.d === (0, ymd_1.daysInMonth)(b.y, b.m)) {
        return 'month';
    }
    if ((0, ymd_1.isoWeekday)(s) === 1 && (0, ymd_1.diffDaysYmd)(s, e) === 6)
        return 'week';
    return 'custom';
}
function previousEquivalentPeriod(period, nowInstant, kind = detectPeriodKind(period)) {
    const tz = period.timezone;
    assertTimezone(tz);
    const { startDate: s, endDate: e } = period;
    const len = (0, ymd_1.diffDaysYmd)(s, e) + 1;
    const detected = detectPeriodKind(period);
    if (kind !== 'custom' && kind !== detected) {
        throw new errors_1.PeriodKindMismatchError(kind, detected);
    }
    let full;
    switch (kind) {
        case 'day':
            full = build((0, ymd_1.addDaysYmd)(s, -1), (0, ymd_1.addDaysYmd)(s, -1), tz, (0, ymd_1.addDaysYmd)(s, -1));
            break;
        case 'week':
            full = weekPeriod((0, ymd_1.addDaysYmd)(s, -7), tz);
            break;
        case 'month': {
            const { y, m } = (0, ymd_1.parseYmd)(s);
            full = m === 1 ? monthPeriod(y - 1, 12, tz) : monthPeriod(y, m - 1, tz);
            break;
        }
        case 'year':
            full = yearPeriod((0, ymd_1.parseYmd)(s).y - 1, tz);
            break;
        default: {
            const ps = (0, ymd_1.addDaysYmd)(s, -len);
            const pe = (0, ymd_1.addDaysYmd)(s, -1);
            full = build(ps, pe, tz, ps === pe ? ps : `${ps} - ${pe}`);
        }
    }
    const today = (0, farm_time_1.localDateIso)(tz, nowInstant);
    const truncatable = kind === 'week' || kind === 'month' || kind === 'year';
    const inProgress = truncatable && today >= s && today <= e;
    if (!inProgress) {
        return { previous: full, partial: false, current: period, kind };
    }
    const elapsed = (0, ymd_1.diffDaysYmd)(s, today) + 1;
    const prevEnd = (0, ymd_1.addDaysYmd)(full.startDate, elapsed - 1);
    const cappedEnd = prevEnd > full.endDate ? full.endDate : prevEnd;
    return {
        previous: build(full.startDate, cappedEnd, tz, `${full.label} (to date)`),
        partial: true,
        current: build(s, today, tz, `${period.label} (to date)`),
        kind,
    };
}
function scheduledRunInstant(period, timezone) {
    assertTimezone(timezone);
    return (0, health_farm_day_1.farmDayStart)((0, ymd_1.addDaysYmd)(period.endDate, 1), timezone);
}
function enumerateDays(period) {
    return (0, ymd_1.enumerateYmd)(period.startDate, period.endDate);
}
//# sourceMappingURL=period-resolver.js.map