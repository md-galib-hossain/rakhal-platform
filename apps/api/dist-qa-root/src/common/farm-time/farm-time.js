"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_FARM_TIMEZONE = void 0;
exports.isValidTimezone = isValidTimezone;
exports.localDateIso = localDateIso;
exports.dayKey = dayKey;
exports.localDayStart = localDayStart;
exports.zonedToUtc = zonedToUtc;
exports.DEFAULT_FARM_TIMEZONE = 'Asia/Dhaka';
function isValidTimezone(timezone) {
    try {
        new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
        return true;
    }
    catch {
        return false;
    }
}
function localDateIso(timezone = exports.DEFAULT_FARM_TIMEZONE, now = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: isValidTimezone(timezone) ? timezone : exports.DEFAULT_FARM_TIMEZONE,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    }).formatToParts(now);
    const get = (type) => parts.find((p) => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
}
function dayKey(dateStr) {
    const d = new Date(dateStr);
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
function localDayStart(timezone = exports.DEFAULT_FARM_TIMEZONE, now = new Date()) {
    return dayKey(localDateIso(timezone, now));
}
const MINUTE_MS = 60_000;
function zoneOffsetMs(timezone, instantMs) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hourCycle: 'h23',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
    }).formatToParts(new Date(instantMs));
    const n = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const asUtc = Date.UTC(n('year'), n('month') - 1, n('day'), n('hour'), n('minute'), n('second'));
    return asUtc - Math.floor(instantMs / 1000) * 1000;
}
function zonedToUtc(timezone, ymd, hm = '00:00') {
    const tz = isValidTimezone(timezone) ? timezone : exports.DEFAULT_FARM_TIMEZONE;
    const [y, mo, d] = ymd.split('-').map(Number);
    const [h, mi] = hm.split(':').map(Number);
    const wallAsUtc = Date.UTC(y, mo - 1, d, h, mi);
    const before = zoneOffsetMs(tz, wallAsUtc - 24 * 60 * MINUTE_MS);
    const after = zoneOffsetMs(tz, wallAsUtc + 24 * 60 * MINUTE_MS);
    const valid = [...new Set([before, after])]
        .map((offset) => wallAsUtc - offset)
        .filter((candidate) => zoneOffsetMs(tz, candidate) === wallAsUtc - candidate)
        .sort((a, b) => a - b);
    if (valid.length > 0)
        return new Date(valid[0]);
    let lo = wallAsUtc - Math.max(before, after) - 24 * 60 * MINUTE_MS;
    let hi = wallAsUtc - Math.min(before, after) + 24 * 60 * MINUTE_MS;
    while (hi - lo > MINUTE_MS) {
        const mid = lo + Math.floor((hi - lo) / MINUTE_MS / 2) * MINUTE_MS;
        if (zoneOffsetMs(tz, mid) === after)
            hi = mid;
        else
            lo = mid;
    }
    return new Date(hi);
}
//# sourceMappingURL=farm-time.js.map