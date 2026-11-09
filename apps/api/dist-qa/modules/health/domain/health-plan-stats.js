"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NO_SCHEDULE = void 0;
exports.planKind = planKind;
exports.countStepsByFarmDay = countStepsByFarmDay;
exports.computePlanStats = computePlanStats;
const health_reminder_cadence_1 = require("./health-reminder-cadence");
function planKind(category) {
    if (category === 'TREATMENT')
        return 'TREATMENT';
    if (category === 'BREEDING')
        return 'BREEDING';
    return 'PREVENTION';
}
const OPEN_CASE_STATUSES = new Set([
    'ACTIVE',
    'IMPROVING',
    'WORSENING',
    'STABLE',
]);
exports.NO_SCHEDULE = {
    stepsDue: 0,
    stepsOverdue: 0,
    nextDueDate: null,
};
function countStepsByFarmDay(dueTimes, timezone, now = new Date()) {
    let stepsDue = 0;
    let stepsOverdue = 0;
    for (const due of dueTimes) {
        const days = (0, health_reminder_cadence_1.farmDaysUntil)(due, timezone, now);
        if (days === 0)
            stepsDue += 1;
        else if (days < 0)
            stepsOverdue += 1;
    }
    return { stepsDue, stepsOverdue };
}
const pct = (num, den) => den > 0 ? Math.round((num / den) * 1000) / 10 : null;
function computePlanStats(category, cases, enrollments, dueSteps, schedule = exports.NO_SCHEDULE) {
    const kind = planKind(category);
    if (kind === 'TREATMENT') {
        const recovered = cases.filter((c) => c.status === 'RECOVERED').length;
        const mortality = cases.filter((c) => c.status === 'MORTALITY').length;
        return {
            ...schedule,
            kind,
            appliedTo: new Set(cases.map((c) => c.cattleId)).size,
            inProgress: cases.filter((c) => OPEN_CASE_STATUSES.has(c.status)).length,
            recovered,
            mortality,
            recoveryRate: pct(recovered, recovered + mortality),
            completed: null,
            due: null,
            coverageRate: null,
        };
    }
    const completed = enrollments.filter((e) => e.status === 'COMPLETED').length;
    return {
        ...schedule,
        kind,
        appliedTo: new Set(enrollments.map((e) => e.cattleId)).size,
        inProgress: enrollments.filter((e) => e.status === 'ACTIVE').length,
        recovered: null,
        mortality: null,
        recoveryRate: null,
        completed,
        due: dueSteps,
        coverageRate: pct(completed, enrollments.length),
    };
}
//# sourceMappingURL=health-plan-stats.js.map