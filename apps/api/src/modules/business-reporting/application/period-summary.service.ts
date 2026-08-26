import { Injectable } from '@nestjs/common';
import { LedgerAccountCategory } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { ledgerCategoryNet } from 'src/common/finance/txn-filters';
import { changePct, derivePreviousPeriod } from 'src/common/finance/period';
import { BalanceService } from 'src/modules/finance-v2/accounts/application/balance.service';
import { AgingService } from './aging.service';

interface PeriodMetric {
  current: number;
  previous: number;
  changePct: number | null;
}

export interface FinanceSummary {
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  revenue: PeriodMetric;
  expenses: PeriodMetric;
  netProfit: PeriodMetric;
  netCashFlow: PeriodMetric;
  position: {
    availableBalance: string;
    totalReceivable: string;
    receivableCount: number;
    totalPayable: string;
    payableCount: number;
    accountCount: number;
  };
}

/**
 * `GET /finance/summary?from&to` (RAKHAL-371, MILESTONE 22, `BUSINESS_IA_PRD.md`
 * §4.4, §6.1, §6.2). Row A (`position`) vs Row B (`revenue`/`expenses`/
 * `netProfit`/`netCashFlow`) split matches the design doc's own rule: a
 * point-in-time balance never takes `from`/`to` — `position` always reads
 * "now", regardless of the requested period — while every other metric is
 * period-scoped and carries a `previous`/`changePct` comparison via the
 * shared `derivePreviousPeriod` (`common/finance/period.ts`, also used by
 * `DashboardService.financialSnapshot` so there is exactly one
 * implementation of the previous-period rule).
 *
 * `revenue`/`expenses` reuse `ledgerCategoryNet` (`common/finance/txn-filters.ts`)
 * over the REVENUE/EXPENSE `LedgerAccount` categories — the same accrual
 * source every other Finance V2 reader already uses. `netCashFlow` is a
 * different number on purpose: the net debit/credit movement restricted to
 * entries whose `ledgerAccountId` backs a real `FinancialAccount` — a credit
 * sale moves `revenue` but not `netCashFlow` until it is actually paid.
 */
@Injectable()
export class PeriodSummaryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly balance: BalanceService,
    private readonly aging: AgingService,
  ) {}

  async getSummary(
    farmId: string,
    from: Date,
    to: Date,
  ): Promise<FinanceSummary> {
    const previous = derivePreviousPeriod({ from, to });

    const [
      revenueCurrent,
      revenuePrevious,
      expensesCurrent,
      expensesPrevious,
      cashFlowCurrent,
      cashFlowPrevious,
      rakhalBalance,
      receivablesAging,
      payablesAging,
    ] = await Promise.all([
      ledgerCategoryNet(this.prisma, farmId, LedgerAccountCategory.REVENUE, {
        gte: from,
        lt: to,
      }),
      ledgerCategoryNet(this.prisma, farmId, LedgerAccountCategory.REVENUE, {
        gte: previous.from,
        lt: previous.to,
      }),
      ledgerCategoryNet(this.prisma, farmId, LedgerAccountCategory.EXPENSE, {
        gte: from,
        lt: to,
      }),
      ledgerCategoryNet(this.prisma, farmId, LedgerAccountCategory.EXPENSE, {
        gte: previous.from,
        lt: previous.to,
      }),
      this.cashFlowNet(farmId, from, to),
      this.cashFlowNet(farmId, previous.from, previous.to),
      this.balance.getRakhalBalance(farmId),
      this.aging.getReceivablesAging(farmId, new Date()),
      this.aging.getPayablesAging(farmId, new Date()),
    ]);

    const profitCurrent = revenueCurrent - expensesCurrent;
    const profitPrevious = revenuePrevious - expensesPrevious;

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      previousPeriod: {
        from: previous.from.toISOString(),
        to: previous.to.toISOString(),
      },
      revenue: {
        current: revenueCurrent,
        previous: revenuePrevious,
        changePct: changePct(revenueCurrent, revenuePrevious),
      },
      expenses: {
        current: expensesCurrent,
        previous: expensesPrevious,
        changePct: changePct(expensesCurrent, expensesPrevious),
      },
      netProfit: {
        current: profitCurrent,
        previous: profitPrevious,
        changePct: changePct(profitCurrent, profitPrevious),
      },
      netCashFlow: {
        current: cashFlowCurrent,
        previous: cashFlowPrevious,
        changePct: changePct(cashFlowCurrent, cashFlowPrevious),
      },
      position: {
        availableBalance: rakhalBalance.rakhalBalance.toString(),
        totalReceivable: receivablesAging.totalOutstanding,
        receivableCount: receivablesAging.totalCount,
        totalPayable: payablesAging.totalOutstanding,
        payableCount: payablesAging.totalCount,
        accountCount: rakhalBalance.accounts.length,
      },
    };
  }

  /** Net cash movement for the period: `SUM(debit) - SUM(credit)` restricted
   * to entries whose `ledgerAccountId` backs a real `FinancialAccount` — the
   * same restriction `TransactionFeedService`'s `cashAmount` uses per row,
   * here summed across the whole period in one aggregate. */
  private async cashFlowNet(
    farmId: string,
    from: Date,
    to: Date,
  ): Promise<number> {
    const accounts = await this.prisma.financialAccount.findMany({
      where: { farmId },
      select: { ledgerAccountId: true },
    });
    if (accounts.length === 0) return 0;

    const agg = await this.prisma.journalEntry.aggregate({
      where: {
        ledgerAccountId: { in: accounts.map((a) => a.ledgerAccountId) },
        journalTransaction: { transactionDate: { gte: from, lt: to } },
      },
      _sum: { debit: true, credit: true },
    });
    return Number(agg._sum.debit ?? 0) - Number(agg._sum.credit ?? 0);
  }
}
