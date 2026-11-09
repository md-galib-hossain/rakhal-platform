"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.applyTimeOfDay = applyTimeOfDay;
function partsInZone(date, timeZone) {
    const f = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const p = {};
    for (const part of f.formatToParts(date)) {
        if (part.type !== 'literal')
            p[part.type] = Number(part.value);
    }
    return p;
}
function zoneOffsetMs(date, timeZone) {
    const p = partsInZone(date, timeZone);
    const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}
function applyTimeOfDay(due, timeOfDay, timeZone) {
    if (!timeOfDay)
        return due;
    const m = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeOfDay);
    if (!m)
        return due;
    const day = partsInZone(due, timeZone);
    const guess = Date.UTC(day.year, day.month - 1, day.day, Number(m[1]), Number(m[2]));
    let instant = guess - zoneOffsetMs(new Date(guess), timeZone);
    instant = guess - zoneOffsetMs(new Date(instant), timeZone);
    return new Date(instant);
}
//# sourceMappingURL=protocol-time.js.map