"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ASSUMED_PEAK_DIM = void 0;
exports.computeLookahead = computeLookahead;
exports.ASSUMED_PEAK_DIM = 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;
const utcDay = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const daysUntil = (target, now) => Math.round((utcDay(target) - utcDay(now)) / MS_PER_DAY);
function computeLookahead(input) {
    const { now, windowDays } = input;
    const events = [];
    if (input.dryOffDate) {
        const d = daysUntil(input.dryOffDate, now);
        if (d <= windowDays)
            events.push({ kind: 'dry_off', in_days: d });
    }
    if (input.expectedCalvingDate) {
        const d = daysUntil(input.expectedCalvingDate, now);
        if (d <= windowDays)
            events.push({ kind: 'calving', in_days: d });
    }
    if (input.lactationStart && input.peakDaysInMilk == null) {
        const peak = new Date(utcDay(input.lactationStart) + exports.ASSUMED_PEAK_DIM * MS_PER_DAY);
        const d = daysUntil(peak, now);
        if (d >= 0 && d <= windowDays)
            events.push({ kind: 'peak_dim', in_days: d });
    }
    return events.sort((a, b) => a.in_days - b.in_days);
}
//# sourceMappingURL=lookahead.js.map