"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.fetchSubmittedMilkRows = fetchSubmittedMilkRows;
exports.countUnsubmittedDrafts = countUnsubmittedDrafts;
exports.fetchExpectedSessions = fetchExpectedSessions;
const client_1 = require("@prisma/client");
const farm_time_1 = require("../../../../../common/farm-time/farm-time");
const DEFAULT_SESSIONS = [
    client_1.MilkSession.MORNING,
    client_1.MilkSession.EVENING,
];
async function fetchSubmittedMilkRows(db, args) {
    if (args.cattleIds.length === 0)
        return [];
    const rows = await db.milkLogEntry.findMany({
        where: {
            farmId: args.farmId,
            cattleId: { in: [...args.cattleIds] },
            logDate: { gte: (0, farm_time_1.dayKey)(args.from), lte: (0, farm_time_1.dayKey)(args.to) },
            submitted: true,
        },
        select: {
            cattleId: true,
            logDate: true,
            session: true,
            yieldL: true,
            disposition: true,
            submitted: true,
        },
        orderBy: [{ logDate: 'asc' }, { id: 'asc' }],
    });
    return rows;
}
async function countUnsubmittedDrafts(db, args) {
    if (args.cattleIds.length === 0)
        return 0;
    return db.milkLogEntry.count({
        where: {
            farmId: args.farmId,
            cattleId: { in: [...args.cattleIds] },
            logDate: { gte: (0, farm_time_1.dayKey)(args.from), lte: (0, farm_time_1.dayKey)(args.to) },
            submitted: false,
        },
    });
}
async function fetchExpectedSessions(db, farmId) {
    const s = await db.farmModuleSettings.findUnique({
        where: { farmId },
        select: { milkActiveSessions: true },
    });
    if (!s)
        return DEFAULT_SESSIONS;
    const valid = new Set(Object.values(client_1.MilkSession));
    return s.milkActiveSessions
        .map((x) => x.toUpperCase())
        .filter((x) => valid.has(x));
}
//# sourceMappingURL=milk-fetch.js.map