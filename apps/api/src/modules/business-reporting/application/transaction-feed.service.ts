import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { add, subtract, toStorage, type Money } from 'src/common/money';
import { CursorPage, getCursorArgs, toCursorPage } from 'src/common/pagination';
import { ListTransactionsQueryDto } from '../presentation/dto/list-transactions-query.dto';
import {
  describeSourceType,
  PARTY_RESOLVABLE_SOURCE_TYPES,
} from '../domain/transaction-source';

export interface TransactionListRow {
  id: string;
  transactionDate: string;
  type: string;
  typeLabel: string;
  reference: string | null;
  party: { id: string; name: string } | null;
  accounts: string[];
  amount: string;
  cashAmount: string;
  status: 'POSTED' | 'REVERSED';
  createdBy: string | null;
  source: { type: string; id: string; label: string; href: string | null };
}

interface PartyResolution {
  reference: string | null;
  party: { id: string; name: string } | null;
}

/**
 * Unified Transactions feed (RAKHAL-370, MILESTONE 22, `BUSINESS_IA_PRD.md`
 * §5.3, §5.14, §9.1). Cursor-paginated over `JournalTransaction` **headers**
 * only — never `JournalEntry` lines, per ADR-023 ("`JournalTransaction`
 * headers are farmer-visible; `JournalEntry` lines and the chart of accounts
 * remain internal"). No `debit`/`credit`/`ledgerAccountId` ever appears on
 * the returned shape; the Account column resolves to the farmer-facing
 * `FinancialAccount` name via the same `LedgerAccount` join `AgingService`
 * uses, never the internal chart itself.
 *
 * `amount` (document gross) is `SUM(entries.debit)` for the transaction —
 * every `JournalTransaction` is balanced by construction (RAKHAL-334 AC),
 * so this always equals `SUM(credit)` too and needs no per-source-type
 * document lookup. `cashAmount` restricts that same sum/difference to only
 * the entries whose `ledgerAccountId` backs a real `FinancialAccount` — a
 * credit sale (Dr Accounts Receivable / Cr Revenue, neither side a
 * `FinancialAccount`) correctly reports `cashAmount: 0` while still
 * appearing in the feed with its real `amount`.
 */
@Injectable()
export class TransactionFeedService {
  constructor(private readonly prisma: PrismaService) {}

  async listTransactions(
    farmId: string,
    query: ListTransactionsQueryDto,
  ): Promise<CursorPage<TransactionListRow>> {
    let ledgerAccountIdFilter: string | undefined;
    if (query.financialAccountId) {
      const account = await this.prisma.financialAccount.findFirst({
        where: { id: query.financialAccountId, farmId },
        select: { ledgerAccountId: true },
      });
      if (!account) {
        return {
          items: [],
          meta: {
            count: 0,
            limit: query.limit,
            hasNextPage: false,
            hasPreviousPage: Boolean(query.cursor),
            startCursor: null,
            endCursor: null,
          },
        };
      }
      ledgerAccountIdFilter = account.ledgerAccountId;
    }

    const where: Prisma.JournalTransactionWhereInput = {
      farmId,
      ...(query.type ? { sourceType: query.type } : {}),
      ...(query.status ? { status: query.status } : {}),
      ...(query.from || query.to
        ? {
            transactionDate: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
      ...(ledgerAccountIdFilter
        ? { entries: { some: { ledgerAccountId: ledgerAccountIdFilter } } }
        : {}),
    };

    const rows = await this.prisma.journalTransaction.findMany({
      where,
      orderBy: [{ transactionDate: query.sortOrder }, { id: query.sortOrder }],
      ...getCursorArgs(query),
    });

    const page = toCursorPage(rows, query);
    if (page.items.length === 0) {
      return { items: [], meta: page.meta };
    }

    const txnIds = page.items.map((t) => t.id);

    const [entries, financialAccounts, resolutions, users] = await Promise.all([
      this.prisma.journalEntry.findMany({
        where: { journalTransactionId: { in: txnIds } },
        select: {
          journalTransactionId: true,
          ledgerAccountId: true,
          debit: true,
          credit: true,
        },
      }),
      this.prisma.financialAccount.findMany({
        where: { farmId },
        select: { name: true, ledgerAccountId: true },
      }),
      this.resolveParties(page.items),
      this.prisma.user.findMany({
        where: {
          id: { in: [...new Set(page.items.map((t) => t.createdById))] },
        },
        select: { id: true, name: true },
      }),
    ]);

    const accountNameByLedgerId = new Map(
      financialAccounts.map((a) => [a.ledgerAccountId, a.name]),
    );
    const userNameById = new Map(users.map((u) => [u.id, u.name]));

    const amountByTxn = new Map<string, Money>();
    const cashDebitByTxn = new Map<string, Money>();
    const cashCreditByTxn = new Map<string, Money>();
    const accountsByTxn = new Map<string, Set<string>>();
    for (const id of txnIds) {
      amountByTxn.set(id, toStorage(0));
      cashDebitByTxn.set(id, toStorage(0));
      cashCreditByTxn.set(id, toStorage(0));
      accountsByTxn.set(id, new Set());
    }
    for (const e of entries) {
      amountByTxn.set(
        e.journalTransactionId,
        add(amountByTxn.get(e.journalTransactionId)!, e.debit),
      );
      const accountName = accountNameByLedgerId.get(e.ledgerAccountId);
      if (accountName) {
        cashDebitByTxn.set(
          e.journalTransactionId,
          add(cashDebitByTxn.get(e.journalTransactionId)!, e.debit),
        );
        cashCreditByTxn.set(
          e.journalTransactionId,
          add(cashCreditByTxn.get(e.journalTransactionId)!, e.credit),
        );
        accountsByTxn.get(e.journalTransactionId)!.add(accountName);
      }
    }

    const items: TransactionListRow[] = page.items.map((t) => {
      const descriptor = describeSourceType(t.sourceType);
      const resolution = resolutions.get(`${t.sourceType}:${t.sourceId}`) ?? {
        reference: null,
        party: null,
      };
      return {
        id: t.id,
        transactionDate: t.transactionDate.toISOString(),
        type: t.sourceType,
        typeLabel: descriptor.label,
        reference: resolution.reference,
        party: resolution.party,
        accounts: [...(accountsByTxn.get(t.id) ?? [])],
        amount: amountByTxn.get(t.id)!.toString(),
        cashAmount: subtract(
          cashDebitByTxn.get(t.id)!,
          cashCreditByTxn.get(t.id)!,
        ).toString(),
        status: t.status,
        createdBy: userNameById.get(t.createdById) ?? null,
        source: {
          type: t.sourceType,
          id: t.sourceId,
          label: descriptor.label,
          href: descriptor.buildHref(t.sourceId),
        },
      };
    });

    return { items, meta: page.meta };
  }

  /**
   * Batches one query per `sourceType` actually present on the page (never
   * per row) — the ≤6-extra-queries-per-page budget RD-069 documents.
   */
  private async resolveParties(
    txns: { sourceType: string; sourceId: string }[],
  ): Promise<Map<string, PartyResolution>> {
    const idsByType = new Map<string, string[]>();
    for (const t of txns) {
      if (
        (PARTY_RESOLVABLE_SOURCE_TYPES as readonly string[]).includes(
          t.sourceType,
        )
      ) {
        idsByType.set(t.sourceType, [
          ...(idsByType.get(t.sourceType) ?? []),
          t.sourceId,
        ]);
      }
    }

    const result = new Map<string, PartyResolution>();

    const saleIds = idsByType.get('SALE');
    if (saleIds?.length) {
      const sales = await this.prisma.sale.findMany({
        where: { id: { in: saleIds } },
        select: {
          id: true,
          saleNumber: true,
          customer: { select: { id: true, name: true } },
        },
      });
      for (const s of sales) {
        result.set(`SALE:${s.id}`, {
          reference: s.saleNumber,
          party: s.customer,
        });
      }
    }

    const purchaseIds = idsByType.get('PURCHASE');
    if (purchaseIds?.length) {
      const purchases = await this.prisma.purchase.findMany({
        where: { id: { in: purchaseIds } },
        select: {
          id: true,
          purchaseNumber: true,
          supplier: { select: { id: true, name: true } },
        },
      });
      for (const p of purchases) {
        result.set(`PURCHASE:${p.id}`, {
          reference: p.purchaseNumber,
          party: p.supplier,
        });
      }
    }

    const expenseIds = idsByType.get('EXPENSE');
    if (expenseIds?.length) {
      const expenses = await this.prisma.expense.findMany({
        where: { id: { in: expenseIds } },
        select: {
          id: true,
          description: true,
          supplier: { select: { id: true, name: true } },
        },
      });
      for (const e of expenses) {
        result.set(`EXPENSE:${e.id}`, {
          reference: e.description,
          party: e.supplier,
        });
      }
    }

    return result;
  }
}
