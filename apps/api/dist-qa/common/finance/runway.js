"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.computeRunwaySnapshot = computeRunwaySnapshot;
const client_1 = require("@prisma/client");
const txn_filters_1 = require("./txn-filters");
const DAY_MS = 24 * 60 * 60 * 1000;
async function computeRunwaySnapshot(prisma, farmId, liquidity, thresholds, now = new Date()) {
    const from = new Date(now.getTime() - 30 * DAY_MS);
    const expense30 = await (0, txn_filters_1.ledgerCategoryNet)(prisma, farmId, client_1.LedgerAccountCategory.EXPENSE, { gte: from, lt: now });
    const avgDailyExpense = expense30 / 30;
    const days = avgDailyExpense > 0 ? Math.floor(liquidity / avgDailyExpense) : null;
    const status = days == null
        ? 'unknown'
        : days < thresholds.criticalDays
            ? 'critical'
            : days < thresholds.warningDays
                ? 'warning'
                : 'healthy';
    return { days, status };
}
//# sourceMappingURL=runway.js.map