import { Injectable } from '@nestjs/common';
import { LedgerAccountCategory } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { toStorage, add, isZero, Money } from 'src/common/money';

export interface ProfitLossLine {
  code: string;
  name: string;
  amount: string;
}

export interface ProfitLossReport {
  period: { from: string; to: string };
  revenue: { lines: ProfitLossLine[]; total: string };
  expenses: { lines: ProfitLossLine[]; total: string };
  netProfit: string;
}

const CREDIT_NORMAL: ReadonlySet<LedgerAccountCategory> = new Set([
  LedgerAccountCategory.REVENUE,
]);

interface RawLine {
  code: string;
  name: string;
  amount: Money;
}

/**
 * `GET /finance/reports/profit-loss?from&to` (RAKHAL-379, MILESTONE 22,
 * `BUSINESS_IA_PRD.md` §5.6, §9.2). Unlike `PeriodSummaryService.getSummary`
 * (RAKHAL-371), which lumps the whole REVENUE/EXPENSE category into one
 * `ledgerCategoryNet` number, this groups by **individual `LedgerAccount`**
 * within each category — each row's `name` is already farmer-facing
 * ("Milk Sales", "Feed", "Salary", per `default-chart-of-accounts.ts`),
 * never an account code shown as the label. Zero-activity accounts are
 * dropped from the line list (a real P&L never shows a blank row).
 */
@Injectable()
export class ProfitLossReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(
    farmId: string,
    from: Date,
    to: Date,
  ): Promise<ProfitLossReport> {
    const [revenue, expenses] = await Promise.all([
      this.categoryLines(farmId, LedgerAccountCategory.REVENUE, from, to),
      this.categoryLines(farmId, LedgerAccountCategory.EXPENSE, from, to),
    ]);
    const revenueTotal = revenue.reduce(
      (sum, l) => add(sum, l.amount),
      toStorage(0),
    );
    const expensesTotal = expenses.reduce(
      (sum, l) => add(sum, l.amount),
      toStorage(0),
    );

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      revenue: {
        lines: revenue.map((l) => ({ ...l, amount: l.amount.toString() })),
        total: revenueTotal.toString(),
      },
      expenses: {
        lines: expenses.map((l) => ({ ...l, amount: l.amount.toString() })),
        total: expensesTotal.toString(),
      },
      netProfit: revenueTotal.minus(expensesTotal).toString(),
    };
  }

  private async categoryLines(
    farmId: string,
    category: LedgerAccountCategory,
    from: Date,
    to: Date,
  ): Promise<RawLine[]> {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { farmId, category },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    });
    if (accounts.length === 0) return [];

    const grouped = await this.prisma.journalEntry.groupBy({
      by: ['ledgerAccountId'],
      where: {
        ledgerAccountId: { in: accounts.map((a) => a.id) },
        journalTransaction: { transactionDate: { gte: from, lt: to } },
      },
      _sum: { debit: true, credit: true },
    });
    const sumsById = new Map(grouped.map((g) => [g.ledgerAccountId, g._sum]));
    const isCreditNormal = CREDIT_NORMAL.has(category);

    return accounts
      .map((a) => {
        const s = sumsById.get(a.id);
        const debit = Number(s?.debit ?? 0);
        const credit = Number(s?.credit ?? 0);
        const net = isCreditNormal ? credit - debit : debit - credit;
        return { code: a.code, name: a.name, amount: toStorage(net) };
      })
      .filter((l) => !isZero(l.amount));
  }
}
