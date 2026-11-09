"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notHistoricalClause = notHistoricalClause;
exports.fetchCohortServices = fetchCohortServices;
exports.fetchPendingServices = fetchPendingServices;
exports.fetchCalvings = fetchCalvings;
exports.fetchAbortions = fetchAbortions;
exports.fetchExpectedCalvings = fetchExpectedCalvings;
exports.fetchLinkedExpenses = fetchLinkedExpenses;
const money_1 = require("src/common/money");
const range = (p) => ({
    gte: new Date(p.start),
    lt: new Date(p.end),
});
const SERVICE_SELECT = {
    cattleId: true,
    breedingMethod: true,
    status: true,
    financeTransactionId: true,
    expectedPregnancyCheckDate: true,
};
async function notHistoricalClause(db, farmId) {
    const rows = await db.animalEvent.findMany({
        where: {
            farmId,
            provenance: 'HISTORICAL',
            status: 'ACTIVE',
            type: { in: ['BREEDING', 'CALVING', 'ABORTION'] },
        },
        select: { id: true },
    });
    if (rows.length === 0)
        return {};
    return {
        OR: [
            { animalEventId: null },
            { animalEventId: { notIn: rows.map((r) => r.id) } },
        ],
    };
}
async function fetchCohortServices(db, farmId, cattleIds, period, notHistorical = {}) {
    if (cattleIds.length === 0)
        return [];
    const rows = await db.breedingEvent.findMany({
        where: {
            cattleId: { in: [...cattleIds] },
            cattle: { farmId },
            voidedAt: null,
            breedingDate: range(period),
            ...notHistorical,
        },
        select: SERVICE_SELECT,
    });
    return rows.map((r) => ({ ...r, voidedAt: null }));
}
async function fetchPendingServices(db, farmId, cattleIds, notHistorical = {}) {
    if (cattleIds.length === 0)
        return [];
    const rows = await db.breedingEvent.findMany({
        where: {
            cattleId: { in: [...cattleIds] },
            cattle: { farmId },
            voidedAt: null,
            status: 'PENDING_CHECK',
            ...notHistorical,
        },
        select: SERVICE_SELECT,
    });
    return rows.map((r) => ({ ...r, voidedAt: null }));
}
async function fetchCalvings(db, farmId, cattleIds, period, notHistorical = {}) {
    if (cattleIds.length === 0)
        return { calvings: 0, calves: 0 };
    const rows = await db.calvingEvent.findMany({
        where: {
            cattleId: { in: [...cattleIds] },
            cattle: { farmId },
            calvingDate: range(period),
            ...notHistorical,
        },
        select: { calfCount: true },
    });
    return {
        calvings: rows.length,
        calves: rows.reduce((s, r) => s + r.calfCount, 0),
    };
}
async function fetchAbortions(db, farmId, cattleIds, period, notHistorical = {}) {
    if (cattleIds.length === 0)
        return 0;
    return db.abortionEvent.count({
        where: {
            cattleId: { in: [...cattleIds] },
            cattle: { farmId },
            abortionDate: range(period),
            ...notHistorical,
        },
    });
}
async function fetchExpectedCalvings(db, farmId, cattleIds, from, to) {
    if (cattleIds.length === 0)
        return 0;
    return db.pregnancy.count({
        where: {
            cattleId: { in: [...cattleIds] },
            cattle: { farmId },
            status: 'ACTIVE',
            expectedCalvingDate: { gte: from, lt: to },
        },
    });
}
async function fetchLinkedExpenses(db, farmId, expenseIds) {
    if (expenseIds.length === 0)
        return [];
    const rows = await db.expense.findMany({
        where: { id: { in: [...expenseIds] }, farmId, voidedAt: null },
        select: { amount: true },
    });
    return rows.map((r) => (0, money_1.toMoney)(r.amount));
}
//# sourceMappingURL=repro-fetch.js.map