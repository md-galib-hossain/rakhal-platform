"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FINANCE_DEFINITIONS = exports.expenseCategoryId = exports.EXPENSES_TOTAL_ID = exports.CLOSING_CASH_ID = exports.OPENING_CASH_ID = exports.NET_CASH_FLOW_ID = exports.CASH_PAID_ID = exports.CASH_RECEIVED_ID = exports.FINANCE_CALC_VERSION = void 0;
const client_1 = require("@prisma/client");
exports.FINANCE_CALC_VERSION = 1;
const base = {
    domain: 'finance',
    requiresPermission: 'finance.read',
    calcVersion: exports.FINANCE_CALC_VERSION,
};
exports.CASH_RECEIVED_ID = 'finance.cash_received';
exports.CASH_PAID_ID = 'finance.cash_paid';
exports.NET_CASH_FLOW_ID = 'finance.net_cash_flow';
exports.OPENING_CASH_ID = 'finance.opening_cash_balance';
exports.CLOSING_CASH_ID = 'finance.closing_cash_balance';
exports.EXPENSES_TOTAL_ID = 'finance.expenses_total';
const expenseCategoryId = (c) => `finance.expenses_by_category.${c}`;
exports.expenseCategoryId = expenseCategoryId;
const CASH_RULE = 'Journal entries on ledger accounts backing a FinancialAccount (archived accounts included); excludes account-to-account transfers (except the fee, counted as paid), and opening-balance seeding. Reversals count in the period they post (original and reversal net across periods).';
const CASH_MISSING = 'No financial accounts => missing. Accounts but no activity => explicit 0.';
exports.FINANCE_DEFINITIONS = [
    {
        ...base,
        id: exports.CASH_RECEIVED_ID,
        unit: 'BDT',
        formula: 'SUM(debit) on cash-backed ledger accounts in [start,end)',
        eligibilityRule: CASH_RULE,
        missingDataRule: CASH_MISSING,
    },
    {
        ...base,
        id: exports.CASH_PAID_ID,
        unit: 'BDT',
        formula: 'SUM(credit) on cash-backed ledger accounts in [start,end) + transfer fees',
        eligibilityRule: CASH_RULE,
        missingDataRule: CASH_MISSING,
    },
    {
        ...base,
        id: exports.NET_CASH_FLOW_ID,
        unit: 'BDT',
        formula: 'cash received - cash paid',
        eligibilityRule: CASH_RULE,
        missingDataRule: CASH_MISSING,
    },
    {
        ...base,
        id: exports.OPENING_CASH_ID,
        unit: 'BDT',
        formula: 'SUM(debit - credit) on cash-backed accounts before period start',
        eligibilityRule: 'All entries incl. opening-balance seeding and transfers.',
        missingDataRule: 'No financial accounts => missing.',
    },
    {
        ...base,
        id: exports.CLOSING_CASH_ID,
        unit: 'BDT',
        formula: 'SUM(debit - credit) on cash-backed accounts before period end',
        eligibilityRule: 'All entries incl. opening-balance seeding and transfers. Differs from opening + net flow only by opening-balance seeding posted in the period.',
        missingDataRule: 'No financial accounts => missing.',
    },
    {
        ...base,
        id: exports.EXPENSES_TOTAL_ID,
        unit: 'BDT',
        formula: 'SUM(Expense.amount) with expenseDate in [start,end), not voided',
        eligibilityRule: 'Accrual by expense date (may be unpaid): not a cash figure.',
        missingDataRule: 'No expenses => explicit 0.',
    },
    ...Object.values(client_1.ExpenseCategory).map((c) => ({
        ...base,
        id: (0, exports.expenseCategoryId)(c),
        unit: 'BDT',
        formula: `SUM(Expense.amount) where category = ${c}, not voided`,
        eligibilityRule: 'Accrual by expense date: not a cash figure.',
        missingDataRule: 'Emitted only when current or previous period has data.',
    })),
];
//# sourceMappingURL=finance-definitions.js.map