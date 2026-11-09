"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_CHART_OF_ACCOUNTS = void 0;
const client_1 = require("@prisma/client");
exports.DEFAULT_CHART_OF_ACCOUNTS = [
    { category: client_1.LedgerAccountCategory.ASSET, code: '1000', name: 'Cash' },
    { category: client_1.LedgerAccountCategory.ASSET, code: '1010', name: 'Bank' },
    { category: client_1.LedgerAccountCategory.ASSET, code: '1020', name: 'MFS' },
    {
        category: client_1.LedgerAccountCategory.ASSET,
        code: '1100',
        name: 'Accounts Receivable',
    },
    { category: client_1.LedgerAccountCategory.ASSET, code: '1200', name: 'Inventory' },
    {
        category: client_1.LedgerAccountCategory.LIABILITY,
        code: '2000',
        name: 'Accounts Payable',
    },
    { category: client_1.LedgerAccountCategory.LIABILITY, code: '2100', name: 'Loans' },
    {
        category: client_1.LedgerAccountCategory.EQUITY,
        code: '3000',
        name: 'Opening Balance Equity',
    },
    { category: client_1.LedgerAccountCategory.REVENUE, code: '4000', name: 'Milk Sales' },
    {
        category: client_1.LedgerAccountCategory.REVENUE,
        code: '4100',
        name: 'Animal Sales',
    },
    {
        category: client_1.LedgerAccountCategory.REVENUE,
        code: '4200',
        name: 'Manure Sales',
    },
    {
        category: client_1.LedgerAccountCategory.REVENUE,
        code: '4300',
        name: 'Inventory Sales',
    },
    {
        category: client_1.LedgerAccountCategory.REVENUE,
        code: '4900',
        name: 'Other Income',
    },
    { category: client_1.LedgerAccountCategory.EXPENSE, code: '5000', name: 'Feed' },
    { category: client_1.LedgerAccountCategory.EXPENSE, code: '5100', name: 'Medicine' },
    { category: client_1.LedgerAccountCategory.EXPENSE, code: '5200', name: 'Salary' },
    { category: client_1.LedgerAccountCategory.EXPENSE, code: '5300', name: 'Breeding' },
    { category: client_1.LedgerAccountCategory.EXPENSE, code: '5400', name: 'Utilities' },
    {
        category: client_1.LedgerAccountCategory.EXPENSE,
        code: '5500',
        name: 'Transfer Fee',
    },
    {
        category: client_1.LedgerAccountCategory.EXPENSE,
        code: '5600',
        name: 'Depreciation',
    },
    {
        category: client_1.LedgerAccountCategory.EXPENSE,
        code: '5900',
        name: 'Other Expense',
    },
];
//# sourceMappingURL=default-chart-of-accounts.js.map