import { Injectable } from '@nestjs/common';
import { FinancialAccountType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { toStorage, add, subtract, Money } from 'src/common/money';

export interface CashFlowAccountLine {
  id: string;
  name: string;
  type: FinancialAccountType;
  openingBalance: string;
  inflow: string;
  outflow: string;
  closingBalance: string;
}

export interface CashFlowReport {
  period: { from: string; to: string };
  accounts: CashFlowAccountLine[];
  totals: {
    openingBalance: string;
    inflow: string;
    outflow: string;
    closingBalance: string;
  };
}

/**
 * `GET /finance/reports/cash-flow?from&to` (RAKHAL-379, MILESTONE 22,
 * `BUSINESS_IA_PRD.md` §5.6, §9.2). Inflow/outflow by `FinancialAccount`,
 * with opening (as of `from`) and closing (as of `to`) balance — the same
 * asset-account sign convention `BalanceService` documents (debit increases,
 * credit decreases), applied here with a date boundary rather than
 * `BalanceService`'s own always-"now" `sumLedgerAccount`. Archived accounts
 * are excluded, same default `BalanceService.getFarmBalances` uses — a
 * closed account's money already moved out through a real cash-flow event on
 * some other still-active account before archiving, so nothing here is lost.
 */
@Injectable()
export class CashFlowReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(
    farmId: string,
    from: Date,
    to: Date,
  ): Promise<CashFlowReport> {
    const accounts = await this.prisma.financialAccount.findMany({
      where: { farmId, deletedAt: null },
      select: { id: true, name: true, type: true, ledgerAccountId: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const lines: CashFlowAccountLine[] = await Promise.all(
      accounts.map(async (a) => {
        const opening = await this.balanceBefore(a.ledgerAccountId, from);
        const { inflow, outflow } = await this.movement(
          a.ledgerAccountId,
          from,
          to,
        );
        const closing = add(opening, subtract(inflow, outflow));
        return {
          id: a.id,
          name: a.name,
          type: a.type,
          openingBalance: opening.toString(),
          inflow: inflow.toString(),
          outflow: outflow.toString(),
          closingBalance: closing.toString(),
        };
      }),
    );

    const totals = lines.reduce(
      (acc, l) => ({
        openingBalance: add(acc.openingBalance, l.openingBalance),
        inflow: add(acc.inflow, l.inflow),
        outflow: add(acc.outflow, l.outflow),
        closingBalance: add(acc.closingBalance, l.closingBalance),
      }),
      {
        openingBalance: toStorage(0),
        inflow: toStorage(0),
        outflow: toStorage(0),
        closingBalance: toStorage(0),
      },
    );

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      accounts: lines,
      totals: {
        openingBalance: totals.openingBalance.toString(),
        inflow: totals.inflow.toString(),
        outflow: totals.outflow.toString(),
        closingBalance: totals.closingBalance.toString(),
      },
    };
  }

  /** `SUM(debit) - SUM(credit)` for every entry strictly before `at` —
   * the account's balance the instant the period opened. */
  private async balanceBefore(
    ledgerAccountId: string,
    at: Date,
  ): Promise<Money> {
    const agg = await this.prisma.journalEntry.aggregate({
      where: {
        ledgerAccountId,
        journalTransaction: { transactionDate: { lt: at } },
      },
      _sum: { debit: true, credit: true },
    });
    return subtract(agg._sum.debit ?? 0, agg._sum.credit ?? 0);
  }

  /** Gross debit (inflow) and gross credit (outflow) within `[from, to)` —
   * kept separate rather than netted, since a cash-flow report shows both
   * directions of movement, not just the delta. */
  private async movement(
    ledgerAccountId: string,
    from: Date,
    to: Date,
  ): Promise<{ inflow: Money; outflow: Money }> {
    const agg = await this.prisma.journalEntry.aggregate({
      where: {
        ledgerAccountId,
        journalTransaction: { transactionDate: { gte: from, lt: to } },
      },
      _sum: { debit: true, credit: true },
    });
    return {
      inflow: toStorage(agg._sum.debit ?? 0),
      outflow: toStorage(agg._sum.credit ?? 0),
    };
  }
}
