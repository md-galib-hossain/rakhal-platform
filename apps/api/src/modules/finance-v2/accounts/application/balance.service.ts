import { Injectable, NotFoundException } from '@nestjs/common';
import { FinancialAccountType } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { Money, add, subtract, sum, zero } from 'src/common/money';

export interface AccountBalance {
  id: string;
  name: string;
  type: FinancialAccountType;
  balance: Money;
}

export interface FarmBalances {
  accounts: AccountBalance[];
  byType: Record<FinancialAccountType, Money>;
}

export interface RakhalBalanceResult {
  rakhalBalance: Money;
  breakdown: {
    cash: Money;
    bank: Money;
    mfs: Money;
  };
  accounts: AccountBalance[];
}

/**
 * Balance projection (RAKHAL-336, Finance V2 — `FINANCE_V2_DESIGN.md` §3).
 * Every balance here is **computed from `JournalEntry` on every read** —
 * there is no stored balance column anywhere in Finance V2 (`FinancialAccount`
 * itself has none, per RAKHAL-335) and this service deliberately adds no
 * cache of its own. Caching is explicitly deferred to **RD-059** — see
 * `docs/TECH_DEBT.md` — and must not be added here.
 *
 * **Sign convention**: every `FinancialAccount`'s own `LedgerAccount` is
 * created with `category: ASSET` (RAKHAL-335,
 * `financial-account.service.ts`'s `createWithClient` — always `ASSET`,
 * regardless of CASH/BANK/MFS). Standard double-entry: for an asset account,
 * debits increase the balance and credits decrease it, so
 * `balance = SUM(debit) - SUM(credit)`. This matches RAKHAL-335's own opening
 * balance posting, which **debits** the new account's ledger account to
 * *increase* it (and credits Opening Balance Equity) — see
 * `FinancialAccountService.createWithClient`'s `postJournal` call.
 *
 * **Rakhal Balance = Cash + Bank + MFS** (`FINANCE_V2_DESIGN.md` §3), computed
 * over **active (non-archived) accounts only** — an archived account is a
 * dead container per RAKHAL-335's own invariant ("an archived account cannot
 * receive new transactions"), so its historical balance is no longer part of
 * "where the farm's money currently is". Receivables are explicitly excluded
 * (that money has not arrived) and **Rakhal Credit (§37 of the PRD) is never
 * referenced anywhere in this service** — it is a distinct, out-of-scope
 * concept (`FINANCE_V2_DESIGN.md` §3, §2.1).
 */
@Injectable()
export class BalanceService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(BalanceService.name);
  }

  /**
   * The balance of one `FinancialAccount`, derived by summing every
   * `JournalEntry` posted against that account's own `ledgerAccountId`.
   * Never reads a stored column. Throws `NotFoundException` for an
   * unknown/cross-farm id, same convention as
   * `FinancialAccountService.getOrThrow`.
   */
  async getAccountBalance(
    farmId: string,
    financialAccountId: string,
  ): Promise<AccountBalance> {
    const account = await this.prisma.financialAccount.findFirst({
      where: { id: financialAccountId, farmId },
      select: { id: true, name: true, type: true, ledgerAccountId: true },
    });
    if (!account) {
      throw new NotFoundException('Financial account not found');
    }
    const balance = await this.sumLedgerAccount(account.ledgerAccountId);
    return { id: account.id, name: account.name, type: account.type, balance };
  }

  /**
   * Every active `FinancialAccount` for the farm with its computed balance,
   * plus a sum grouped by `type` (CASH/BANK/MFS). Archived accounts are
   * excluded by default (matches `FinancialAccountService.findAll`'s own
   * default and `getRakhalBalance`'s scope).
   */
  async getFarmBalances(
    farmId: string,
    includeArchived = false,
  ): Promise<FarmBalances> {
    const rows = await this.prisma.financialAccount.findMany({
      where: { farmId, ...(includeArchived ? {} : { deletedAt: null }) },
      select: { id: true, name: true, type: true, ledgerAccountId: true },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });

    const accounts: AccountBalance[] = [];
    const byType: Record<FinancialAccountType, Money> = {
      [FinancialAccountType.CASH]: zero(),
      [FinancialAccountType.BANK]: zero(),
      [FinancialAccountType.MFS]: zero(),
    };

    for (const row of rows) {
      const balance = await this.sumLedgerAccount(row.ledgerAccountId);
      accounts.push({
        id: row.id,
        name: row.name,
        type: row.type,
        balance,
      });
      byType[row.type] = add(byType[row.type], balance);
    }

    return { accounts, byType };
  }

  /**
   * The headline number (`FINANCE_V2_DESIGN.md` §3):
   * `Rakhal Balance = Cash + Bank + MFS`, over active accounts only.
   * Receivables are excluded (not yet arrived) and Rakhal Credit (§37) is
   * never summed in — it is out of scope for this milestone and is not even
   * referenced by this module.
   */
  async getRakhalBalance(farmId: string): Promise<RakhalBalanceResult> {
    const { accounts, byType } = await this.getFarmBalances(farmId, false);
    const rakhalBalance = sum([
      byType[FinancialAccountType.CASH],
      byType[FinancialAccountType.BANK],
      byType[FinancialAccountType.MFS],
    ]);

    this.log.info('Rakhal Balance computed', {
      farmId,
      rakhalBalance: rakhalBalance.toString(),
      accountCount: accounts.length,
    });

    return {
      rakhalBalance,
      breakdown: {
        cash: byType[FinancialAccountType.CASH],
        bank: byType[FinancialAccountType.BANK],
        mfs: byType[FinancialAccountType.MFS],
      },
      accounts,
    };
  }

  /** `SUM(debit) - SUM(credit)` for every `JournalEntry` against one ledger
   * account — the asset-account sign convention documented on the class. */
  private async sumLedgerAccount(ledgerAccountId: string): Promise<Money> {
    const agg = await this.prisma.journalEntry.aggregate({
      where: { ledgerAccountId },
      _sum: { debit: true, credit: true },
    });
    return subtract(agg._sum.debit ?? 0, agg._sum.credit ?? 0);
  }
}
