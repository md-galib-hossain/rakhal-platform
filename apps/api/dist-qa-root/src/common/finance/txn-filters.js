"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ledgerCategoryNet = ledgerCategoryNet;
exports.ledgerAccountNet = ledgerAccountNet;
exports.deriveOutstanding = deriveOutstanding;
const client_1 = require("@prisma/client");
const CREDIT_NORMAL_CATEGORIES = new Set([
    client_1.LedgerAccountCategory.REVENUE,
    client_1.LedgerAccountCategory.LIABILITY,
    client_1.LedgerAccountCategory.EQUITY,
]);
async function ledgerCategoryNet(prisma, farmId, category, range) {
    const agg = await prisma.journalEntry.aggregate({
        where: {
            ledgerAccount: { farmId, category },
            ...(range ? { journalTransaction: { transactionDate: range } } : {}),
        },
        _sum: { debit: true, credit: true },
    });
    const debit = Number(agg._sum.debit ?? 0);
    const credit = Number(agg._sum.credit ?? 0);
    return CREDIT_NORMAL_CATEGORIES.has(category)
        ? credit - debit
        : debit - credit;
}
async function ledgerAccountNet(prisma, farmId, code, category, range) {
    const agg = await prisma.journalEntry.aggregate({
        where: {
            ledgerAccount: { farmId, code },
            ...(range ? { journalTransaction: { transactionDate: range } } : {}),
        },
        _sum: { debit: true, credit: true },
    });
    const debit = Number(agg._sum.debit ?? 0);
    const credit = Number(agg._sum.credit ?? 0);
    return CREDIT_NORMAL_CATEGORIES.has(category)
        ? credit - debit
        : debit - credit;
}
function deriveOutstanding(totalAmount, allocated) {
    const raw = Number(totalAmount) - Number(allocated);
    return raw > 0 ? Math.round(raw * 100) / 100 : 0;
}
//# sourceMappingURL=txn-filters.js.map