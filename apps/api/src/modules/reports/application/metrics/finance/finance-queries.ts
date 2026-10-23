import type { Prisma } from '@prisma/client';
import { add, subtract, toMoney, zero, type Money } from 'src/common/money';
import type { ReportDb } from '../metric-context';

/** Journal sourceTypes (verified in finance-v2 services). */
export const TRANSFER_SOURCE = 'FINANCE_TRANSFER';
export const OPENING_BALANCE_SOURCE = 'FINANCIAL_ACCOUNT_OPENING_BALANCE';

export interface CashFlow {
  received: Money;
  paid: Money;
}

const dec = (v: Prisma.Decimal | null | undefined): Money =>
  v == null ? zero() : toMoney(v);

/** Ledger account ids backing FinancialAccounts. Archived included (policy: real cash moved). */
export async function cashLedgerIds(
  db: ReportDb,
  farmId: string,
): Promise<string[]> {
  const rows = await db.financialAccount.findMany({
    where: { farmId },
    select: { ledgerAccountId: true },
  });
  return rows.map((r) => r.ledgerAccountId);
}

/** Reversals are real entries: original and reversal each count in the period they post, so opening + net flow = closing. */
export async function cashFlow(
  db: ReportDb,
  ids: string[],
  from: Date,
  to: Date,
): Promise<CashFlow> {
  const range = { gte: from, lt: to };
  const flows = await db.journalEntry.aggregate({
    where: {
      ledgerAccountId: { in: ids },
      journalTransaction: {
        transactionDate: range,
        sourceType: { notIn: [TRANSFER_SOURCE, OPENING_BALANCE_SOURCE] },
      },
    },
    _sum: { debit: true, credit: true },
  });
  // Between two cash accounts a transfer nets to zero; what is left is the fee, real cash out.
  const transfers = await db.journalEntry.aggregate({
    where: {
      ledgerAccountId: { in: ids },
      journalTransaction: {
        transactionDate: range,
        sourceType: TRANSFER_SOURCE,
      },
    },
    _sum: { debit: true, credit: true },
  });
  const fee = subtract(dec(transfers._sum.credit), dec(transfers._sum.debit));
  return {
    received: dec(flows._sum.debit),
    paid: add(dec(flows._sum.credit), fee.isPositive() ? fee : 0),
  };
}

/** Balance of cash-backed accounts strictly before `at` (all entries). */
export async function balanceBefore(
  db: ReportDb,
  ids: string[],
  at: Date,
): Promise<Money> {
  const agg = await db.journalEntry.aggregate({
    where: {
      ledgerAccountId: { in: ids },
      journalTransaction: { transactionDate: { lt: at } },
    },
    _sum: { debit: true, credit: true },
  });
  return subtract(dec(agg._sum.debit), dec(agg._sum.credit));
}

export async function expensesByCategory(
  db: ReportDb,
  farmId: string,
  from: Date,
  to: Date,
): Promise<Map<string, Money>> {
  const rows = await db.expense.groupBy({
    by: ['category'],
    where: { farmId, voidedAt: null, expenseDate: { gte: from, lt: to } },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.category, dec(r._sum.amount)]));
}
