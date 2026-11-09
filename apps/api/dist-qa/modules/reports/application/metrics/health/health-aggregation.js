"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ACTIVE_WITHDRAWAL_STATUSES = exports.LIVE_TASK_STATUSES = exports.CLOSED_CASE_STATUSES = void 0;
exports.distinct = distinct;
exports.casesOpened = casesOpened;
exports.casesClosed = casesClosed;
exports.casesRecovered = casesRecovered;
exports.casesMortality = casesMortality;
exports.casesOpenAt = casesOpenAt;
exports.treatmentsGiven = treatmentsGiven;
exports.overdueTasks = overdueTasks;
exports.preventiveCompleted = preventiveCompleted;
exports.preventiveMissed = preventiveMissed;
exports.repeatedCases = repeatedCases;
exports.activeWithdrawals = activeWithdrawals;
exports.vetFees = vetFees;
exports.treatmentCost = treatmentCost;
const health_case_outcome_1 = require("src/modules/health/domain/health-case-outcome");
const money_1 = require("src/common/money");
const metric_value_1 = require("../../../domain/contracts/metric-value");
exports.CLOSED_CASE_STATUSES = [
    'RECOVERED',
    'MORTALITY',
    'CLOSED',
];
exports.LIVE_TASK_STATUSES = [
    'PENDING',
    'RESCHEDULED',
    'OVERDUE',
];
const inWindow = (d, w) => !!d && d.getTime() >= w.start.getTime() && d.getTime() < w.end.getTime();
function distinct(ids) {
    return Array.from(new Set(ids));
}
const countWithCows = (rows) => ({
    events: rows.length,
    cows: distinct(rows.map((r) => r.cattleId)),
});
function casesOpened(cases, w) {
    return countWithCows(cases.filter((c) => inWindow(c.startDate, w)));
}
function casesClosed(cases, w) {
    return cases.filter((c) => exports.CLOSED_CASE_STATUSES.includes(c.status) && inWindow(c.closedDate, w)).length;
}
function casesRecovered(cases, w) {
    return cases.filter((c) => c.status === 'RECOVERED' && inWindow(c.closedDate, w)).length;
}
function casesMortality(cases, w) {
    return cases.filter((c) => c.status === 'MORTALITY' && inWindow(c.closedDate, w)).length;
}
function casesOpenAt(cases, at) {
    return cases.filter((c) => {
        if (c.startDate.getTime() >= at.getTime())
            return false;
        if (c.closedDate)
            return c.closedDate.getTime() >= at.getTime();
        return !exports.CLOSED_CASE_STATUSES.includes(c.status);
    }).length;
}
function treatmentsGiven(treatments) {
    return countWithCows(treatments);
}
function overdueTasks(tasks, now) {
    return tasks.filter((t) => exports.LIVE_TASK_STATUSES.includes(t.status) &&
        t.dueDateTime.getTime() < now.getTime());
}
function preventiveCompleted(tasks, w) {
    return tasks.filter((t) => t.planEnrollmentId !== null &&
        t.status === 'COMPLETED' &&
        inWindow(t.completedAt, w)).length;
}
function preventiveMissed(tasks, w) {
    return tasks.filter((t) => t.planEnrollmentId !== null &&
        t.status === 'MISSED' &&
        inWindow(t.dueDateTime, w)).length;
}
function repeatedCases(opened, candidates, windowDays) {
    const timelines = candidates.map(toTimeline);
    const repeated = opened.filter((c) => (0, health_case_outcome_1.findPreviousSameCondition)(toTimeline(c), timelines, windowDays) !== null);
    return countWithCows(repeated);
}
const toTimeline = (c) => ({
    id: c.id,
    cattleId: c.cattleId,
    condition: c.condition,
    startDate: c.startDate,
    closedDate: c.closedDate,
});
exports.ACTIVE_WITHDRAWAL_STATUSES = [
    'ACTIVE',
    'READY_FOR_RELEASE',
];
function activeWithdrawals(rows) {
    return countWithCows(rows.filter((r) => exports.ACTIVE_WITHDRAWAL_STATUSES.includes(r.status)));
}
const MISSING_REASON = 'reports.dq.unknown_costs';
function finishCost(candidates, resolved, total, unit) {
    if (candidates === 0)
        return {
            value: (0, metric_value_1.valueOf)(0, unit),
            hasUnresolved: false,
            partial: false,
        };
    if (resolved === 0)
        return {
            value: { state: 'missing', reason: MISSING_REASON },
            hasUnresolved: true,
            partial: false,
        };
    const partial = resolved < candidates;
    return {
        value: (0, metric_value_1.valueOf)((0, money_1.round2)(total).toNumber(), unit),
        hasUnresolved: partial,
        partial,
    };
}
function vetFees(treatments, amountById, unit = 'BDT') {
    let candidates = 0;
    let resolved = 0;
    let total = (0, money_1.zero)();
    for (const t of treatments) {
        if (t.vetCost === null || t.vetCost === undefined)
            continue;
        if (t.vetExpenseId && t.vetExpenseId === t.financeTransactionId)
            continue;
        candidates++;
        if (t.vetExpenseId && amountById.has(t.vetExpenseId)) {
            resolved++;
            total = (0, money_1.add)(total, (0, money_1.toMoney)(t.vetCost.toString()));
        }
    }
    return finishCost(candidates, resolved, total, unit);
}
function treatmentCost(treatments, amountById, unit = 'BDT') {
    let resolved = 0;
    let total = (0, money_1.zero)();
    for (const t of treatments) {
        const amt = t.financeTransactionId
            ? amountById.get(t.financeTransactionId)
            : undefined;
        if (amt !== undefined) {
            resolved++;
            total = (0, money_1.add)(total, amt);
        }
    }
    return finishCost(treatments.length, resolved, total, unit);
}
//# sourceMappingURL=health-aggregation.js.map