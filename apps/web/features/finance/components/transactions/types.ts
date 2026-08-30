/**
 * RAKHAL-385 (MILESTONE 22) — Transactions screen types. Mirrors `TransactionListRow`
 * (`business-reporting/application/transaction-feed.service.ts`, RAKHAL-370) directly, confirmed
 * against the live backend source — the full shape, unlike Overview's narrower
 * `overview/types.ts#RecentTransactionRow`. `amount`/`cashAmount` are Decimal-as-string.
 */
export interface TransactionRow {
  id: string;
  transactionDate: string;
  type: string;
  typeLabel: string;
  reference: string | null;
  party: { id: string; name: string } | null;
  accounts: string[];
  amount: string;
  cashAmount: string;
  status: "POSTED" | "REVERSED";
  createdBy: string | null;
  source: { type: string; id: string; label: string; href: string | null };
}

/** `ListTransactionsQueryDto` — every field is optional, `type`/`financialAccountId` stay plain
 * strings (backend's own doc comment: `type` filters the raw `sourceType` string, not a closed
 * Prisma enum). */
export interface TransactionsFilters {
  type?: string;
  status?: "POSTED" | "REVERSED";
  from?: string;
  to?: string;
  financialAccountId?: string;
}

/**
 * `TRANSACTION_SOURCE_REGISTRY` keys (`business-reporting/domain/transaction-source.ts`) — the
 * real, current set of `sourceType` values the backend can ever return. **Flagged gap, not faked**:
 * `BUSINESS_IA_PRD.md` §5.3's mockup lists a finer "All Types" breakdown (Milk Sale / Animal Sale /
 * Manure Sale / Inventory Sale as separate entries, Payment Received / Payment Made as separate
 * entries) that the backend cannot produce — every sale collapses to one `SALE` sourceType
 * regardless of product, and `FINANCE_PAYMENT` carries no stored direction field (only a `cashAmount`
 * sign, which is a derived fact about entries, not a filterable column). Filtering on the mockup's
 * finer values would silently return nothing. This list is the real, working set; the granularity
 * gap is TECH_DEBT-worthy and out of this ticket's scope (370 already shipped, this ticket only
 * consumes it).
 */
export const TRANSACTION_TYPE_OPTIONS = [
  "SALE",
  "PURCHASE",
  "EXPENSE",
  "FINANCE_PAYMENT",
  "FINANCE_TRANSFER",
  "OTHER_INCOME",
  "FEED_MIXTURE_FINALIZE",
  "FINANCIAL_ACCOUNT_OPENING_BALANCE",
] as const;
export type TransactionTypeOption = (typeof TRANSACTION_TYPE_OPTIONS)[number];
