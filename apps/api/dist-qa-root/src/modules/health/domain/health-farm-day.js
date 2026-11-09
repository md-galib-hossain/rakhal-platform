"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.farmDayStart = farmDayStart;
exports.farmDayEnd = farmDayEnd;
function offsetMs(timezone, at) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: timezone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).formatToParts(at);
    const get = (type) => Number(parts.find((p) => p.type === type)?.value ?? 0);
    const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
    return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}
function farmDayStart(ymd, timezone) {
    const [y, m, d] = ymd.split('-').map(Number);
    const utcMidnight = Date.UTC(y, m - 1, d);
    const first = utcMidnight - offsetMs(timezone, new Date(utcMidnight));
    return new Date(utcMidnight - offsetMs(timezone, new Date(first)));
}
function farmDayEnd(ymd, timezone) {
    const [y, m, d] = ymd.split('-').map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    return farmDayStart(next, timezone);
}
//# sourceMappingURL=health-farm-day.js.map