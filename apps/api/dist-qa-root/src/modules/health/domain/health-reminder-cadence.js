"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OVERDUE_EVENT_KEY = exports.STAGE_EVENT_KEY = exports.OVERDUE_MAX_DAYS = exports.HEALTH_REMINDER_CADENCE = void 0;
exports.farmDaysUntil = farmDaysUntil;
exports.stageForDaysUntil = stageForDaysUntil;
exports.reminderFor = reminderFor;
const farm_time_1 = require("src/common/farm-time/farm-time");
exports.HEALTH_REMINDER_CADENCE = [
    { stage: 'T_MINUS_7', daysUntil: 7 },
    { stage: 'T_MINUS_3', daysUntil: 3 },
    { stage: 'T_MINUS_1', daysUntil: 1 },
    { stage: 'DAY_OF', daysUntil: 0 },
];
exports.OVERDUE_MAX_DAYS = 30;
exports.STAGE_EVENT_KEY = {
    T_MINUS_7: 'health_task_reminder',
    T_MINUS_3: 'health_task_reminder',
    T_MINUS_1: 'health_task_due_tomorrow',
    DAY_OF: 'health_task_due_today',
};
exports.OVERDUE_EVENT_KEY = 'health_task_overdue';
const DAY_MS = 24 * 60 * 60 * 1000;
function farmDaysUntil(due, timezone, now = new Date()) {
    const dueDay = (0, farm_time_1.dayKey)((0, farm_time_1.localDateIso)(timezone, due)).getTime();
    const today = (0, farm_time_1.dayKey)((0, farm_time_1.localDateIso)(timezone, now)).getTime();
    return Math.round((dueDay - today) / DAY_MS);
}
function stageForDaysUntil(daysUntil) {
    return (exports.HEALTH_REMINDER_CADENCE.find((s) => s.daysUntil === daysUntil)?.stage ??
        null);
}
function reminderFor(daysUntil) {
    if (daysUntil < 0) {
        const daysOverdue = -daysUntil;
        return daysOverdue <= exports.OVERDUE_MAX_DAYS
            ? { kind: 'overdue', daysOverdue }
            : null;
    }
    const stage = stageForDaysUntil(daysUntil);
    return stage ? { kind: 'stage', stage, daysUntil } : null;
}
//# sourceMappingURL=health-reminder-cadence.js.map