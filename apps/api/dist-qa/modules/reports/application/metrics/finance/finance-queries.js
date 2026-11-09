"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OPENING_BALANCE_SOURCE = exports.TRANSFER_SOURCE = void 0;
exports.cashLedgerIds = cashLedgerIds;
exports.cashFlow = cashFlow;
exports.balanceBefore = balanceBefore;
exports.expensesByCategory = expensesByCategory;
const money_1 = require("src/common/money");
exports.TRANSFER_SOURCE = 'FINANCE_TRANSFER';
exports.OPENING_BALANCE_SOURCE = 'FINANCIAL_ACCOUNT_OPENING_BALANCE';
const dec = (v) => v == null ? (0, money_1.zero)() : (0, money_1.toMoney)(v);
async function cashLedgerIds(db, farmId) {
    const rows = await db.financialAccount.findMany({
        where: { farmId },
        select: { ledgerAccountId: true },
    });
    return rows.map((r) => r.ledgerAccountId);
}
async function cashFlow(db, ids, from, to) {
    const range = { gte: from, lt: to };
    const flows = await db.journalEntry.aggregate({
        where: {
            ledgerAccountId: { in: ids },
            journalTransaction: {
                transactionDate: range,
                sourceType: { notIn: [exports.TRANSFER_SOURCE, exports.OPENING_BALANCE_SOURCE] },
            },
        },
        _sum: { debit: true, credit: true },
    });
    const transfers = await db.journalEntry.aggregate({
        where: {
            ledgerAccountId: { in: ids },
            journalTransaction: {
                transactionDate: range,
                sourceType: exports.TRANSFER_SOURCE,
            },
        },
        _sum: { debit: true, credit: true },
    });
    const fee = (0, money_1.subtract)(dec(transfers._sum.credit), dec(transfers._sum.debit));
    return {
        received: dec(flows._sum.debit),
        paid: (0, money_1.add)(dec(flows._sum.credit), fee.isPositive() ? fee : 0),
    };
}
async function balanceBefore(db, ids, at) {
    const agg = await db.journalEntry.aggregate({
        where: {
            ledgerAccountId: { in: ids },
            journalTransaction: { transactionDate: { lt: at } },
        },
        _sum: { debit: true, credit: true },
    });
    return (0, money_1.subtract)(dec(agg._sum.debit), dec(agg._sum.credit));
}
async function expensesByCategory(db, farmId, from, to) {
    const rows = await db.expense.groupBy({
        by: ['category'],
        where: { farmId, voidedAt: null, expenseDate: { gte: from, lt: to } },
        _sum: { amount: true },
    });
    return new Map(rows.map((r) => [r.category, dec(r._sum.amount)]));
}
//# sourceMappingURL=finance-queries.js.map