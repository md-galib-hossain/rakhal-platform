import { ExpenseCategory } from '@prisma/client';
import type { MetricDefinition } from '../../../domain/contracts/metric-definition';

export const FINANCE_CALC_VERSION = 1;

const base = {
  domain: 'finance',
  requiresPermission: 'finance.read',
  calcVersion: FINANCE_CALC_VERSION,
} as const;

export const CASH_RECEIVED_ID = 'finance.cash_received';
export const CASH_PAID_ID = 'finance.cash_paid';
export const NET_CASH_FLOW_ID = 'finance.net_cash_flow';
export const OPENING_CASH_ID = 'finance.opening_cash_balance';
export const CLOSING_CASH_ID = 'finance.closing_cash_balance';
export const EXPENSES_TOTAL_ID = 'finance.expenses_total';
export const expenseCategoryId = (c: string) =>
  `finance.expenses_by_category.${c}` as const;

const CASH_RULE =
  'Journal entries on ledger accounts backing a FinancialAccount (archived accounts included); excludes account-to-account transfers (except the fee, counted as paid), and opening-balance seeding. Reversals count in the period they post (original and reversal net across periods).';
const CASH_MISSING =
  'No financial accounts => missing. Accounts but no activity => explicit 0.';

export const FINANCE_DEFINITIONS: readonly MetricDefinition[] = [
  {
    ...base,
    id: CASH_RECEIVED_ID,
    unit: 'BDT',
    formula: 'SUM(debit) on cash-backed ledger accounts in [start,end)',
    eligibilityRule: CASH_RULE,
    missingDataRule: CASH_MISSING,
  },
  {
    ...base,
    id: CASH_PAID_ID,
    unit: 'BDT',
    formula:
      'SUM(credit) on cash-backed ledger accounts in [start,end) + transfer fees',
    eligibilityRule: CASH_RULE,
    missingDataRule: CASH_MISSING,
  },
  {
    ...base,
    id: NET_CASH_FLOW_ID,
    unit: 'BDT',
    formula: 'cash received - cash paid',
    eligibilityRule: CASH_RULE,
    missingDataRule: CASH_MISSING,
  },
  {
    ...base,
    id: OPENING_CASH_ID,
    unit: 'BDT',
    formula: 'SUM(debit - credit) on cash-backed accounts before period start',
    eligibilityRule: 'All entries incl. opening-balance seeding and transfers.',
    missingDataRule: 'No financial accounts => missing.',
  },
  {
    ...base,
    id: CLOSING_CASH_ID,
    unit: 'BDT',
    formula: 'SUM(debit - credit) on cash-backed accounts before period end',
    eligibilityRule:
      'All entries incl. opening-balance seeding and transfers. Differs from opening + net flow only by opening-balance seeding posted in the period.',
    missingDataRule: 'No financial accounts => missing.',
  },
  {
    ...base,
    id: EXPENSES_TOTAL_ID,
    unit: 'BDT',
    formula: 'SUM(Expense.amount) with expenseDate in [start,end), not voided',
    eligibilityRule:
      'Accrual by expense date (may be unpaid): not a cash figure.',
    missingDataRule: 'No expenses => explicit 0.',
  },
  ...Object.values(ExpenseCategory).map(
    (c): MetricDefinition => ({
      ...base,
      id: expenseCategoryId(c),
      unit: 'BDT',
      formula: `SUM(Expense.amount) where category = ${c}, not voided`,
      eligibilityRule: 'Accrual by expense date: not a cash figure.',
      missingDataRule: 'Emitted only when current or previous period has data.',
    }),
  ),
];
