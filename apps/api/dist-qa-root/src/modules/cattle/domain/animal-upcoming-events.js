"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_EVENT_LIMIT = exports.DEFAULT_WINDOW_DAYS = exports.DUE_SOON_DAYS = exports.DUE_WEEK_DAYS = exports.DUE_FILTERS = void 0;
exports.farmDaysUntil = farmDaysUntil;
exports.urgencyForDaysUntil = urgencyForDaysUntil;
exports.buildAnimalUpcomingEvents = buildAnimalUpcomingEvents;
const farm_time_1 = require("src/common/farm-time/farm-time");
exports.DUE_FILTERS = ['overdue', 'today', 'week'];
exports.DUE_WEEK_DAYS = 7;
exports.DUE_SOON_DAYS = 3;
exports.DEFAULT_WINDOW_DAYS = 14;
exports.DEFAULT_EVENT_LIMIT = 10;
const DAY_MS = 24 * 60 * 60 * 1000;
const KIND_PRIORITY = [
    'HEALTH_STEP',
    'PREVENTIVE_STEP',
    'PREGNANCY_CHECK',
    'CALVING',
    'DRY_OFF',
    'TASK',
    'WEANING',
    'WITHDRAWAL_END',
];
function farmDaysUntil(due, timezone, now) {
    const dueDay = (0, farm_time_1.dayKey)((0, farm_time_1.localDateIso)(timezone, due)).getTime();
    const today = (0, farm_time_1.dayKey)((0, farm_time_1.localDateIso)(timezone, now)).getTime();
    return Math.round((dueDay - today) / DAY_MS);
}
function urgencyForDaysUntil(daysUntil) {
    if (daysUntil < 0)
        return 'OVERDUE';
    if (daysUntil <= exports.DUE_SOON_DAYS)
        return 'DUE_SOON';
    return 'LATER';
}
function kindRank(kind) {
    const idx = KIND_PRIORITY.indexOf(kind);
    return idx === -1 ? KIND_PRIORITY.length : idx;
}
function compareEvents(a, b) {
    const aOverdue = a.urgency === 'OVERDUE';
    const bOverdue = b.urgency === 'OVERDUE';
    if (aOverdue !== bOverdue)
        return aOverdue ? -1 : 1;
    if (a.actionable !== b.actionable)
        return a.actionable ? -1 : 1;
    if (a.dueAt !== b.dueAt)
        return a.dueAt < b.dueAt ? -1 : 1;
    const byKind = kindRank(a.kind) - kindRank(b.kind);
    if (byKind !== 0)
        return byKind;
    const byRef = a.ref.id.localeCompare(b.ref.id);
    return byRef !== 0 ? byRef : a.labelKey.localeCompare(b.labelKey);
}
function buildAnimalUpcomingEvents(candidates, options) {
    const { now, timezone } = options;
    const windowDays = options.windowDays ?? exports.DEFAULT_WINDOW_DAYS;
    const covered = new Set();
    for (const c of candidates) {
        if (c.kind === 'TASK' || !c.coversSourceKeys?.length)
            continue;
        const day = (0, farm_time_1.localDateIso)(timezone, c.dueAt);
        for (const key of c.coversSourceKeys)
            covered.add(`${key}|${day}`);
    }
    const events = [];
    for (const c of candidates) {
        const daysUntil = farmDaysUntil(c.dueAt, timezone, now);
        if (daysUntil > windowDays)
            continue;
        if (!c.actionable && daysUntil < 0)
            continue;
        if (c.kind === 'TASK' &&
            c.sourceKey &&
            covered.has(`${c.sourceKey}|${(0, farm_time_1.localDateIso)(timezone, c.dueAt)}`)) {
            continue;
        }
        events.push({
            kind: c.kind,
            labelKey: c.labelKey,
            ...(c.labelParams ? { labelParams: c.labelParams } : {}),
            dueAt: c.dueAt.toISOString(),
            daysUntil,
            urgency: urgencyForDaysUntil(daysUntil),
            actionable: c.actionable,
            ref: c.ref,
        });
    }
    return events.sort(compareEvents);
}
//# sourceMappingURL=animal-upcoming-events.js.map