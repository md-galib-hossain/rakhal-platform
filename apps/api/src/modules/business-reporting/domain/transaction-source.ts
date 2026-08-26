/**
 * `JournalTransaction.sourceType` registry (RAKHAL-370, MILESTONE 22,
 * `BUSINESS_IA_PRD.md` §9.1). One place naming every `sourceType` string any
 * `JournalService.postJournal` caller in the codebase actually uses (see the
 * grep this ticket ran across `sourceType:` literals) — `TransactionFeedService`
 * looks a row up here for its human label and drill-through `href` instead of
 * hardcoding a switch inline. Not a Prisma enum: `sourceType` is a plain
 * string column (`journal.prisma`'s own comment), so unknown future values
 * degrade gracefully to `label: sourceType`, `href: null` rather than a
 * runtime crash.
 */
export interface TransactionSourceDescriptor {
  label: string;
  /** `null` when no dedicated detail page exists for this source type yet. */
  buildHref: (sourceId: string) => string | null;
}

export const TRANSACTION_SOURCE_REGISTRY: Record<
  string,
  TransactionSourceDescriptor
> = {
  SALE: { label: 'Sale', buildHref: (id) => `/sales/${id}` },
  PURCHASE: { label: 'Purchase', buildHref: (id) => `/purchasing/${id}` },
  EXPENSE: {
    label: 'Expense',
    buildHref: (id) => `/purchasing/expenses/${id}`,
  },
  FINANCE_PAYMENT: {
    label: 'Payment',
    buildHref: (id) => `/finance/payments/${id}`,
  },
  FINANCE_TRANSFER: {
    label: 'Transfer',
    buildHref: (id) => `/finance/transfers/${id}`,
  },
  OTHER_INCOME: {
    label: 'Other Income',
    buildHref: (id) => `/finance/other-income/${id}`,
  },
  FINANCIAL_ACCOUNT_OPENING_BALANCE: {
    label: 'Opening Balance',
    buildHref: () => null,
  },
  FEED_MIXTURE_FINALIZE: {
    label: 'Feed Mixture',
    buildHref: (id) => `/feed/formulator/${id}`,
  },
};

/**
 * `sourceType`s whose `Party` column resolves from a real document row.
 * `TransactionFeedService` batches exactly one extra query per member of
 * this set that appears on the page (RD-069's ≤6-extra-queries-per-page
 * budget) — anything not in this list gets `party: null`, never an N+1.
 */
export const PARTY_RESOLVABLE_SOURCE_TYPES = [
  'SALE',
  'PURCHASE',
  'EXPENSE',
] as const;

export function describeSourceType(
  sourceType: string,
): TransactionSourceDescriptor {
  return (
    TRANSACTION_SOURCE_REGISTRY[sourceType] ?? {
      label: sourceType,
      buildHref: () => null,
    }
  );
}
