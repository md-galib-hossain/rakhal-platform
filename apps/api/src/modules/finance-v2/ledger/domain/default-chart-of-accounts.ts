import { LedgerAccountCategory } from '@prisma/client';

/**
 * Default chart of accounts every farm is bootstrapped with (RAKHAL-333,
 * `FINANCE_V2_DESIGN.md` §4.4). Standard accounting number ranges: 1xxx
 * assets, 2xxx liabilities, 3xxx equity, 4xxx revenue, 5xxx expense — chosen
 * so a farm-custom account (future ticket, `isSystem: false`) has obvious
 * unused ranges to land in (e.g. `1300`-`1900` for a farm's own asset
 * accounts) without colliding with these system rows.
 *
 * **Internal only.** No controller in this module exposes this list or the
 * `LedgerAccount` rows it produces — the chart of accounts is never
 * farmer-facing UI (§4.4). Farmers see `FinancialAccount` (RAKHAL-335).
 */
export const DEFAULT_CHART_OF_ACCOUNTS: ReadonlyArray<{
  category: LedgerAccountCategory;
  code: string;
  name: string;
}> = [
  // Assets (1xxx)
  { category: LedgerAccountCategory.ASSET, code: '1000', name: 'Cash' },
  { category: LedgerAccountCategory.ASSET, code: '1010', name: 'Bank' },
  { category: LedgerAccountCategory.ASSET, code: '1020', name: 'MFS' },
  {
    category: LedgerAccountCategory.ASSET,
    code: '1100',
    name: 'Accounts Receivable',
  },
  { category: LedgerAccountCategory.ASSET, code: '1200', name: 'Inventory' },

  // Liabilities (2xxx)
  {
    category: LedgerAccountCategory.LIABILITY,
    code: '2000',
    name: 'Accounts Payable',
  },
  { category: LedgerAccountCategory.LIABILITY, code: '2100', name: 'Loans' },

  // Equity (3xxx)
  {
    category: LedgerAccountCategory.EQUITY,
    code: '3000',
    name: 'Opening Balance Equity',
  },

  // Revenue (4xxx)
  { category: LedgerAccountCategory.REVENUE, code: '4000', name: 'Milk Sales' },
  {
    category: LedgerAccountCategory.REVENUE,
    code: '4100',
    name: 'Animal Sales',
  },
  {
    category: LedgerAccountCategory.REVENUE,
    code: '4200',
    name: 'Manure Sales',
  },
  {
    category: LedgerAccountCategory.REVENUE,
    code: '4300',
    name: 'Inventory Sales',
  },
  {
    category: LedgerAccountCategory.REVENUE,
    code: '4900',
    name: 'Other Income',
  },

  // Expenses (5xxx)
  { category: LedgerAccountCategory.EXPENSE, code: '5000', name: 'Feed' },
  { category: LedgerAccountCategory.EXPENSE, code: '5100', name: 'Medicine' },
  { category: LedgerAccountCategory.EXPENSE, code: '5200', name: 'Salary' },
  { category: LedgerAccountCategory.EXPENSE, code: '5300', name: 'Breeding' },
  { category: LedgerAccountCategory.EXPENSE, code: '5400', name: 'Utilities' },
  {
    category: LedgerAccountCategory.EXPENSE,
    code: '5500',
    name: 'Transfer Fee',
  },
  {
    category: LedgerAccountCategory.EXPENSE,
    code: '5600',
    name: 'Depreciation',
  },
  {
    // RAKHAL-367 (MILESTONE 22) — closes RD-060: `ExpenseCategory` had no
    // catch-all category because this chart had no seeded account to post
    // it against. `9000-9999` is reserved for farm-custom accounts
    // (`nextCustomLedgerCode`, RD-061), so `5900` is safely inside the
    // system expense range with no collision.
    category: LedgerAccountCategory.EXPENSE,
    code: '5900',
    name: 'Other Expense',
  },
];
