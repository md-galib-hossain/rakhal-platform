"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STAGE_EVENT_KEY = exports.REMINDER_OVERDUE_MAX_DAYS = exports.FOLLOW_UP_LEAD_DAYS = void 0;
exports.decideReminder = decideReminder;
exports.nextOccurrence = nextOccurrence;
exports.FOLLOW_UP_LEAD_DAYS = 1;
exports.REMINDER_OVERDUE_MAX_DAYS = 30;
exports.STAGE_EVENT_KEY = {
    UPCOMING: 'follow_up_upcoming',
    DUE_TODAY: 'follow_up_due_today',
    OVERDUE: 'follow_up_overdue',
};
function decideReminder(daysUntil, leadDays) {
    if (daysUntil < 0) {
        const daysOverdue = -daysUntil;
        return daysOverdue <= exports.REMINDER_OVERDUE_MAX_DAYS
            ? { stage: 'OVERDUE', daysOverdue }
            : null;
    }
    if (daysUntil === 0)
        return { stage: 'DUE_TODAY', daysUntil: 0 };
    if (leadDays && leadDays > 0 && daysUntil === leadDays) {
        return { stage: 'UPCOMING', daysUntil };
    }
    return null;
}
const DAY_MS = 24 * 60 * 60 * 1000;
function nextOccurrence(from, type, intervalDays) {
    if (type === 'DAILY')
        return new Date(from.getTime() + DAY_MS);
    if (type === 'WEEKLY')
        return new Date(from.getTime() + 7 * DAY_MS);
    if (type === 'EVERY_N_DAYS') {
        return new Date(from.getTime() + Math.max(1, intervalDays ?? 1) * DAY_MS);
    }
    const next = new Date(from);
    next.setMonth(next.getMonth() + 1);
    return next;
}
//# sourceMappingURL=reminder-cadence.js.map