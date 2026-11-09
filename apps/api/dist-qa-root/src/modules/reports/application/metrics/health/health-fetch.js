"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.toWindow = void 0;
exports.fetchCases = fetchCases;
exports.fetchRepeatCandidates = fetchRepeatCandidates;
exports.fetchTreatments = fetchTreatments;
exports.fetchExpenseAmounts = fetchExpenseAmounts;
exports.fetchTasks = fetchTasks;
exports.fetchActiveWithdrawals = fetchActiveWithdrawals;
const money_1 = require("src/common/money");
const health_aggregation_1 = require("./health-aggregation");
const DAY_MS = 24 * 60 * 60 * 1000;
const toWindow = (p) => ({
    start: new Date(p.start),
    end: new Date(p.end),
});
exports.toWindow = toWindow;
async function fetchCases(s, w) {
    return s.db.healthCase.findMany({
        where: {
            farmId: s.farmId,
            cattleId: { in: [...s.cattleIds] },
            deletedAt: null,
            careType: 'CURATIVE',
            startDate: { lt: w.end },
            OR: [{ closedDate: null }, { closedDate: { gte: w.start } }],
        },
        select: {
            id: true,
            cattleId: true,
            condition: true,
            status: true,
            startDate: true,
            closedDate: true,
        },
    });
}
async function fetchRepeatCandidates(s, w, cattleIds, windowDays) {
    if (cattleIds.length === 0)
        return [];
    return s.db.healthCase.findMany({
        where: {
            farmId: s.farmId,
            cattleId: { in: [...cattleIds] },
            deletedAt: null,
            careType: 'CURATIVE',
            condition: { not: null },
            closedDate: {
                gte: new Date(w.start.getTime() - windowDays * DAY_MS),
                lt: w.end,
            },
        },
        select: {
            id: true,
            cattleId: true,
            condition: true,
            status: true,
            startDate: true,
            closedDate: true,
        },
    });
}
async function fetchTreatments(s, w) {
    return s.db.treatmentLog.findMany({
        where: {
            farmId: s.farmId,
            cattleId: { in: [...s.cattleIds] },
            voidedAt: null,
            administeredAt: { gte: w.start, lt: w.end },
            healthCase: { deletedAt: null },
        },
        select: {
            id: true,
            cattleId: true,
            financeTransactionId: true,
            vetCost: true,
            vetExpenseId: true,
        },
    });
}
async function fetchExpenseAmounts(s, ids) {
    const unique = [...new Set(ids)];
    if (unique.length === 0)
        return new Map();
    const rows = await s.db.expense.findMany({
        where: { farmId: s.farmId, id: { in: unique }, voidedAt: null },
        select: { id: true, amount: true },
    });
    return new Map(rows.map((e) => [e.id, (0, money_1.toMoney)(e.amount)]));
}
async function fetchTasks(s, w, now) {
    return s.db.healthTask.findMany({
        where: {
            farmId: s.farmId,
            cattleId: { in: [...s.cattleIds] },
            deletedAt: null,
            OR: [
                ...(now
                    ? [
                        {
                            status: { in: [...health_aggregation_1.LIVE_TASK_STATUSES] },
                            dueDateTime: { lt: now },
                        },
                    ]
                    : []),
                {
                    planEnrollmentId: { not: null },
                    status: 'COMPLETED',
                    completedAt: { gte: w.start, lt: w.end },
                },
                {
                    planEnrollmentId: { not: null },
                    status: 'MISSED',
                    dueDateTime: { gte: w.start, lt: w.end },
                },
            ],
        },
        select: {
            id: true,
            cattleId: true,
            planEnrollmentId: true,
            status: true,
            dueDateTime: true,
            completedAt: true,
        },
    });
}
async function fetchActiveWithdrawals(s) {
    return s.db.safetyWithdrawal.findMany({
        where: {
            farmId: s.farmId,
            cattleId: { in: [...s.cattleIds] },
            status: { in: [...health_aggregation_1.ACTIVE_WITHDRAWAL_STATUSES] },
            healthCase: { deletedAt: null },
        },
        select: { id: true, cattleId: true, status: true },
    });
}
//# sourceMappingURL=health-fetch.js.map