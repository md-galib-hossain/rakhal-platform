import { Injectable } from '@nestjs/common';
import { LedgerAccountCategory } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { toStorage, add, isZero } from 'src/common/money';

export interface TrialBalanceLine {
  code: string;
  name: string;
  category: LedgerAccountCategory;
  debit: string;
  credit: string;
}

export interface TrialBalanceReport {
  asOf: string;
  lines: TrialBalanceLine[];
  totalDebit: string;
  totalCredit: string;
  balanced: boolean;
}

/**
 * `GET /finance/reports/trial-balance?asOf=` (RAKHAL-379, MILESTONE 22,
 * `BUSINESS_IA_PRD.md` §5.6, §9.2). **Owner-only `finance.accounting`,
 * deliberately never in the farmer-facing Reports tab bar** — a trial
 * balance *is* the chart of accounts with debit/credit columns, which
 * directly contradicts ADR-022's "farmers never see debits and credits"
 * rule. Built anyway as the cheapest available ledger-integrity check
 * (`totalDebit === totalCredit` must hold for every farm, always, since
 * `JournalService.postJournal` asserts balance before any write) and
 * because RD-059's eventual reconciliation job needs exactly this query.
 *
 * Every `LedgerAccount` with any activity up to `asOf` gets one row. Column
 * placement is purely sign-based on `net = SUM(debit) - SUM(credit)` — a
 * positive net lands in the debit column, a negative net (as `-net`) in the
 * credit column, **regardless of the account's category** (an account's
 * "normal" side only describes which sign is expected, never which column a
 * given balance is shown in). This is what makes `totalDebit === totalCredit`
 * hold mechanically: summing `net` across every `LedgerAccount` on a farm is
 * exactly zero by the global double-entry invariant, so
 * `SUM(max(net,0)) == SUM(max(-net,0))` always. Distinct from
 * `ledgerCategoryNet`'s signed-net convention (credit-normal categories
 * report a positive number for a credit balance) used elsewhere in this
 * codebase for period comparisons — that convention is wrong for a trial
 * balance's own debit/credit column split.
 */
@Injectable()
export class TrialBalanceReportService {
  constructor(private readonly prisma: PrismaService) {}

  async getReport(farmId: string, asOf: Date): Promise<TrialBalanceReport> {
    const accounts = await this.prisma.ledgerAccount.findMany({
      where: { farmId },
      select: { id: true, code: true, name: true, category: true },
      orderBy: { code: 'asc' },
    });
    if (accounts.length === 0) {
      return {
        asOf: asOf.toISOString(),
        lines: [],
        totalDebit: '0.00',
        totalCredit: '0.00',
        balanced: true,
      };
    }

    const grouped = await this.prisma.journalEntry.groupBy({
      by: ['ledgerAccountId'],
      where: {
        ledgerAccountId: { in: accounts.map((a) => a.id) },
        journalTransaction: { transactionDate: { lte: asOf } },
      },
      _sum: { debit: true, credit: true },
    });
    const sumsById = new Map(grouped.map((g) => [g.ledgerAccountId, g._sum]));

    let totalDebit = toStorage(0);
    let totalCredit = toStorage(0);
    const lines: TrialBalanceLine[] = [];

    for (const account of accounts) {
      const s = sumsById.get(account.id);
      const debit = Number(s?.debit ?? 0);
      const credit = Number(s?.credit ?? 0);
      const net = debit - credit;
      if (net === 0) continue;

      const debitColumn = toStorage(Math.max(net, 0));
      const creditColumn = toStorage(Math.max(-net, 0));

      totalDebit = add(totalDebit, debitColumn);
      totalCredit = add(totalCredit, creditColumn);
      lines.push({
        code: account.code,
        name: account.name,
        category: account.category,
        debit: debitColumn.toString(),
        credit: creditColumn.toString(),
      });
    }

    return {
      asOf: asOf.toISOString(),
      lines,
      totalDebit: totalDebit.toString(),
      totalCredit: totalCredit.toString(),
      balanced: isZero(totalDebit.minus(totalCredit)),
    };
  }
}
