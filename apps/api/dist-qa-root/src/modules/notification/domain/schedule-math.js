"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SYSTEM_JITTER_SECONDS = exports.MAX_OFFSET_DAYS = exports.MAX_REPEAT_INTERVAL_DAYS = exports.DEFAULT_SEND_TIME = exports.MAX_LEAD_MINUTES = exports.MAX_LEADS = exports.SERIES_MAX_ANCHORS = void 0;
exports.isValidSendTime = isValidSendTime;
exports.addDaysYmd = addDaysYmd;
exports.addMonthsClampedYmd = addMonthsClampedYmd;
exports.allDayAnchorYmd = allDayAnchorYmd;
exports.allDayAnchorFromYmd = allDayAnchorFromYmd;
exports.localParts = localParts;
exports.anchorLocalYmd = anchorLocalYmd;
exports.endOfDayKey = endOfDayKey;
exports.validateLeads = validateLeads;
exports.normalizeLeads = normalizeLeads;
exports.computeFireAt = computeFireAt;
exports.jitterSeconds = jitterSeconds;
exports.applyJitter = applyJitter;
exports.eventKeyForBand = eventKeyForBand;
exports.anchorFromEntity = anchorFromEntity;
exports.isAnchorInFuture = isAnchorInFuture;
exports.anchorForIndex = anchorForIndex;
exports.liveOccurrencesForAnchor = liveOccurrencesForAnchor;
exports.firstLiveAnchor = firstLiveAnchor;
exports.advanceSeries = advanceSeries;
exports.validateRepeat = validateRepeat;
const farm_time_1 = require("../../../common/farm-time/farm-time");
exports.SERIES_MAX_ANCHORS = 400;
exports.MAX_LEADS = 4;
exports.MAX_LEAD_MINUTES = 90 * 1440;
exports.DEFAULT_SEND_TIME = '08:00';
exports.MAX_REPEAT_INTERVAL_DAYS = 365;
exports.MAX_OFFSET_DAYS = 3650;
exports.SYSTEM_JITTER_SECONDS = 180;
const DAY_MIN = 1440;
const MINUTE_MS = 60_000;
const HM = /^([01]\d|2[0-3]):[0-5]\d$/;
const YMD = /^\d{4}-\d{2}-\d{2}$/;
function isValidSendTime(hm) {
    return HM.test(hm);
}
function addDaysYmd(ymd, days) {
    const [y, m, d] = ymd.split('-').map(Number);
    return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
function daysInMonth(year, month1) {
    return new Date(Date.UTC(year, month1, 0)).getUTCDate();
}
function addMonthsClampedYmd(baseYmd, months) {
    const [y, m, d] = baseYmd.split('-').map(Number);
    const index = y * 12 + (m - 1) + months;
    const year = Math.floor(index / 12);
    const month1 = (index % 12) + 1;
    const day = Math.min(d, daysInMonth(year, month1));
    return `${String(year).padStart(4, '0')}-${String(month1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
function allDayAnchorYmd(anchorAt) {
    return anchorAt.toISOString().slice(0, 10);
}
function allDayAnchorFromYmd(ymd) {
    return new Date(`${ymd}T00:00:00.000Z`);
}
function localParts(instant, timezone) {
    const ymd = (0, farm_time_1.localDateIso)(timezone, instant);
    const parts = new Intl.DateTimeFormat('en-GB', {
        timeZone: timezone,
        hourCycle: 'h23',
        hour: '2-digit',
        minute: '2-digit',
    }).formatToParts(instant);
    const get = (t) => parts.find((p) => p.type === t)?.value ?? '00';
    return { ymd, hm: `${get('hour')}:${get('minute')}` };
}
function anchorLocalYmd(anchorAt, allDay, timezone) {
    return allDay
        ? allDayAnchorYmd(anchorAt)
        : localParts(anchorAt, timezone).ymd;
}
function endOfDayKey(ymd) {
    return new Date(`${ymd}T23:59:59.999Z`);
}
function validateLeads(leadMinutes, allDay) {
    if (leadMinutes.length === 0)
        return 'LEADS_EMPTY';
    if (leadMinutes.length > exports.MAX_LEADS)
        return 'LEADS_TOO_MANY';
    for (const lead of leadMinutes) {
        if (!Number.isInteger(lead))
            return 'LEAD_NOT_INTEGER';
        if (lead < 0)
            return 'LEAD_NEGATIVE';
        if (lead > exports.MAX_LEAD_MINUTES)
            return 'LEAD_TOO_LONG';
        if (allDay && lead % DAY_MIN !== 0)
            return 'LEAD_NOT_WHOLE_DAYS';
    }
    return null;
}
function normalizeLeads(leadMinutes) {
    return [...new Set(leadMinutes)].sort((a, b) => b - a);
}
function computeFireAt(input) {
    const { anchorAt, allDay, leadMinutes, timezone } = input;
    if (!allDay)
        return new Date(anchorAt.getTime() - leadMinutes * MINUTE_MS);
    const leadDays = Math.ceil(leadMinutes / DAY_MIN);
    const ymd = addDaysYmd(allDayAnchorYmd(anchorAt), -leadDays);
    return (0, farm_time_1.zonedToUtc)(timezone, ymd, input.sendTime ?? exports.DEFAULT_SEND_TIME);
}
function jitterSeconds(occurrenceId) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < occurrenceId.length; i++) {
        hash ^= occurrenceId.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash % exports.SYSTEM_JITTER_SECONDS;
}
function applyJitter(fireAt, occurrenceId, origin) {
    if (origin !== 'SYSTEM')
        return fireAt;
    return new Date(fireAt.getTime() + jitterSeconds(occurrenceId) * 1000);
}
function eventKeyForBand(origin, leadMinutes) {
    if (origin === 'USER')
        return 'custom_reminder';
    return leadMinutes > 0 ? 'scheduled_upcoming' : 'scheduled_due';
}
function anchorFromEntity(input) {
    const { trigger, entityAt, offsetDays, allDay, timezone } = input;
    const signed = trigger === 'BEFORE_EVENT' ? -offsetDays : offsetDays;
    if (allDay) {
        return allDayAnchorFromYmd(addDaysYmd(allDayAnchorYmd(entityAt), signed));
    }
    const { ymd, hm } = localParts(entityAt, timezone);
    return (0, farm_time_1.zonedToUtc)(timezone, addDaysYmd(ymd, signed), hm);
}
function isAnchorInFuture(anchorAt, now) {
    return anchorAt.getTime() > now.getTime();
}
function anchorForIndex(series, k) {
    if (!Number.isInteger(k) || k < 0 || k >= exports.SERIES_MAX_ANCHORS)
        return null;
    const { baseAnchorAt, allDay, repeat, timezone } = series;
    if (repeat === 'NONE' && k > 0)
        return null;
    const baseYmd = anchorLocalYmd(baseAnchorAt, allDay, timezone);
    let ymd = baseYmd;
    if (repeat === 'EVERY_N_DAYS') {
        const interval = series.repeatInterval ?? 0;
        if (interval < 1)
            return null;
        ymd = addDaysYmd(baseYmd, k * interval);
    }
    else if (repeat === 'WEEKLY') {
        ymd = addDaysYmd(baseYmd, 7 * k);
    }
    else if (repeat === 'MONTHLY') {
        ymd = addMonthsClampedYmd(baseYmd, k);
    }
    if (series.repeatEndDate && ymd > allDayAnchorYmd(series.repeatEndDate)) {
        return null;
    }
    if (allDay)
        return allDayAnchorFromYmd(ymd);
    return (0, farm_time_1.zonedToUtc)(timezone, ymd, localParts(baseAnchorAt, timezone).hm);
}
function liveOccurrencesForAnchor(input) {
    const { anchorAt, allDay, sendTime, timezone, now } = input;
    return normalizeLeads(input.leadMinutes)
        .map((leadMinutes) => ({
        anchorAt,
        leadMinutes,
        fireAt: computeFireAt({
            anchorAt,
            allDay,
            sendTime,
            leadMinutes,
            timezone,
        }),
    }))
        .filter((o) => o.fireAt.getTime() >= now.getTime());
}
function firstLiveAnchor(series, fromIndex, now) {
    for (let k = fromIndex; k < exports.SERIES_MAX_ANCHORS; k++) {
        const anchorAt = anchorForIndex(series, k);
        if (!anchorAt)
            return null;
        const occurrences = liveOccurrencesForAnchor({
            anchorAt,
            allDay: series.allDay,
            sendTime: series.sendTime,
            leadMinutes: series.leadMinutes,
            timezone: series.timezone,
            now,
        });
        if (occurrences.length > 0) {
            return { seriesIndex: k, anchorAt, occurrences };
        }
        if (series.repeat === 'NONE')
            return null;
    }
    return null;
}
function advanceSeries(series, currentIndex, now) {
    if (series.repeat === 'NONE')
        return null;
    return firstLiveAnchor(series, currentIndex + 1, now);
}
function validateRepeat(input) {
    if (input.repeat === 'NONE')
        return null;
    if (input.repeat === 'EVERY_N_DAYS') {
        if (input.repeatInterval == null)
            return 'REPEAT_INTERVAL_REQUIRED';
        if (!Number.isInteger(input.repeatInterval) ||
            input.repeatInterval < 1 ||
            input.repeatInterval > exports.MAX_REPEAT_INTERVAL_DAYS) {
            return 'REPEAT_INTERVAL_OUT_OF_RANGE';
        }
    }
    if (input.endDateYmd != null) {
        if (!YMD.test(input.endDateYmd))
            return 'REPEAT_END_INVALID';
        if (input.endDateYmd < input.startYmd)
            return 'REPEAT_END_BEFORE_START';
    }
    return null;
}
//# sourceMappingURL=schedule-math.js.map