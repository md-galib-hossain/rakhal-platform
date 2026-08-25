/**
 * RAKHAL-355 — Finance V2 types, matched to the live backend (`Repos/rakhal-backend/src/modules/
 * finance-v2/accounts/**`, RAKHAL-335, `FINANCE_V2_DESIGN.md` §3/§4.4). Deliberately a **separate
 * file** from `./types.ts` rather than appended to it: `features/finance/**` (V1) is frozen — "no
 * new features on it, you're building alongside it" per this ticket's own brief — and `types.ts`'s
 * doc comment already documents itself as matched to the *V1* `finance.controller.ts` shape. Mixing
 * V1's `LedgerTransaction`/`CreateTransactionPayload` and V2's `FinancialAccount` in one file would
 * make every future V1-deletion diff (RAKHAL-354) larger and easier to get wrong. `-v2` mirrors the
 * backend's own `finance-v2` module folder name, so the naming convention lines up on both sides.
 *
 * Only the Financial Accounts slice is modeled here — the rest of Finance V2 (`Sale`, `Payment`,
 * `Transfer`, `Receivable`/`Payable` v2, …) is out of this ticket's scope (RAKHAL-356+).
 */

export type FinancialAccountType = "CASH" | "BANK" | "MFS";
export type MfsProvider = "BKASH" | "NAGAD" | "ROCKET" | "UPAY" | "OTHER";

export interface BankAccountDetail {
  id: string;
  financialAccountId: string;
  bankName: string;
  accountNumber: string;
  branch: string | null;
}

export interface MfsAccountDetail {
  id: string;
  financialAccountId: string;
  provider: MfsProvider;
  phoneNumber: string;
  accountType: string | null;
}

/** Mirrors `FinancialAccountWithDetail` (`financial-account.service.ts`). No `balance` field — the
 * backend model deliberately has none (`FINANCE_V2_DESIGN.md` §4.4: "no cached account balances" —
 * a balance is always derived from the ledger, RAKHAL-336's separate balance-projection endpoint,
 * not carried on the account row itself). `AccountPicker` doesn't show a balance for this reason;
 * a future ticket wiring the balance projection can add it without reshaping this type. */
export interface FinancialAccount {
  id: string;
  farmId: string;
  name: string;
  type: FinancialAccountType;
  ledgerAccountId: string;
  currency: string;
  isActive: boolean;
  archivedAt: string | null;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  bankDetail: BankAccountDetail | null;
  mfsDetail: MfsAccountDetail | null;
}

/** Mirrors `CreateBankAccountDetailDto`. */
export interface CreateBankAccountDetailPayload {
  bankName: string;
  accountNumber: string;
  branch?: string;
}

/** Mirrors `CreateMfsAccountDetailDto`. */
export interface CreateMfsAccountDetailPayload {
  provider: MfsProvider;
  phoneNumber: string;
  accountType?: string;
}

/** Mirrors `CreateFinancialAccountDto` — `POST /finance/accounts`. `bankDetail` is required when
 * `type === "BANK"`, `mfsDetail` when `type === "MFS"` (enforced server-side; `AccountPicker`'s
 * quick-add form mirrors the same conditional requirement client-side). */
export interface CreateFinancialAccountPayload {
  name: string;
  type: FinancialAccountType;
  currency?: string;
  openingBalance?: number;
  bankDetail?: CreateBankAccountDetailPayload;
  mfsDetail?: CreateMfsAccountDetailPayload;
}

/**
 * RAKHAL-358 — Payments / Receivables / Payables / Allocation, matched to the live backend
 * (`finance-v2/payments/**`, RAKHAL-337; `finance-v2/receivables/**`, RAKHAL-340;
 * `purchasing/{payable,purchase,expense}*`, RAKHAL-348). Appended below the RAKHAL-355 Financial
 * Accounts slice per this file's own doc comment ("only Financial Accounts is modeled here" — that
 * scope note is now widened by this ticket, not superseded).
 *
 * **Money fields are `string`, not `number`** — every `Decimal(18,2)` column round-trips through
 * `JSON.stringify` as a numeric string (`decimal.js`'s own `toJSON()`, which `Prisma.Decimal`
 * inherits — confirmed against `test/finance-v2-payments.e2e-spec.ts:207`'s own
 * `Number(payment.amount)` assertion, i.e. the live wire value is NOT already a JS number). Every
 * display site below converts via `Number(...)` immediately before handing the value to
 * `MoneyText`/`MoneyInput`, same as `Receivable`/`Payable`'s own `outstanding` field (already a
 * `.toString()` per `ReceivableService`/`PayableService`).
 *
 * **`Receivable`/`Payable` status is API-derived, never re-computed client-side** —
 * `FINANCE_V2_DESIGN.md` §4.6 ("Payment status is derived, never chosen") is this ticket's own
 * spec section. `status` always comes straight from `ReceivableWithDerived`/`PayableWithDerived`
 * (`ReceivableService.getStatus`/`PayableService.getStatus`'s exact four-state enum) — no frontend
 * code sums allocations or compares `outstanding` against `0` to guess a status. See
 * `payment-status-badge.tsx`'s own doc comment + its Vitest suite for the enforcement of this rule.
 */
export type PaymentDirection = "INCOMING" | "OUTGOING";

/** Mirrors `ReceivableStatus`/`PayableStatus` (`finance-v2/receivables/domain/receivable-status.ts`,
 * `purchasing/domain/payable-status.ts`) — identical 4-value set on both sides of the books. */
export type SettlementStatusV2 = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

/** Mirrors `ReceivableWithDerived` (`ReceivableService.findOne`/`listReceivables`). `totalAmount`
 * is the snapshot at creation (§4.5 — "the sale is never edited when money arrives"); `outstanding`
 * and `status` are always freshly computed server-side from `PaymentAllocation` sums, never stored. */
export interface Receivable {
  id: string;
  farmId: string;
  saleId: string;
  customerId: string | null;
  totalAmount: string;
  dueDate: string | null;
  closedAt: string | null;
  createdAt: string;
  outstanding: string;
  status: SettlementStatusV2;
}

/** Mirrors `PayableWithDerived` (`PayableService.findOne`/`listPayables`) — same derived-status
 * discipline as `Receivable`, on the liability side. Exactly one of `purchaseId`/`expenseId` is set. */
export interface Payable {
  id: string;
  farmId: string;
  purchaseId: string | null;
  expenseId: string | null;
  supplierId: string | null;
  totalAmount: string;
  dueDate: string | null;
  closedAt: string | null;
  createdAt: string;
  outstanding: string;
  status: SettlementStatusV2;
}

/** Cursor-list filters — mirrors `ListReceivablesQueryDto`. `status` is deliberately not filterable
 * here either (see that DTO's own doc comment — it's derived per-row, not a `WHERE`-able column). */
export interface ListReceivablesFilters {
  customerId?: string;
  dueBefore?: string;
  dueAfter?: string;
}

/** Mirrors `ListPayablesQueryDto`. */
export interface ListPayablesFilters {
  supplierId?: string;
  dueBefore?: string;
  dueAfter?: string;
}

/** Mirrors `FinancePayment` (`finance-v2/payment.prisma`). One payment always hits exactly one
 * `FinancialAccount` — settling a document across several accounts is modeled as several payments
 * (§4.5/§6), which is exactly why `payment-history.tsx` lists every payment allocated to a
 * document rather than assuming one. */
export interface FinancePayment {
  id: string;
  farmId: string;
  direction: PaymentDirection;
  financialAccountId: string;
  amount: string;
  method: import("@/lib/types/payment").PaymentMethod;
  transactionDate: string;
  referenceNumber: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
}

/** Mirrors `PaymentAllocation` — settles part or all of a payment against one `Receivable`/`Payable`.
 * Exactly one of `receivableId`/`payableId` is set per row (application-enforced, not a DB
 * constraint — see the schema's own doc comment). */
export interface PaymentAllocation {
  id: string;
  paymentId: string;
  receivableId: string | null;
  payableId: string | null;
  amount: string;
  createdAt: string;
}

/** Mirrors `FinancePaymentWithAllocations` — `GET /finance/payments/:id`'s response shape (the
 * plain `findAll` list route does NOT include `allocations`, a real gap documented in this ticket's
 * `use-finance-v2.ts` doc comment on `usePaymentHistory`). */
export interface FinancePaymentWithAllocations extends FinancePayment {
  allocations: PaymentAllocation[];
}

/** Mirrors `CreatePaymentDto` — `POST /finance/payments`. `farmId` comes from the token, never the
 * body (house convention). */
export interface CreatePaymentPayload {
  direction: PaymentDirection;
  financialAccountId: string;
  amount: number;
  method: import("@/lib/types/payment").PaymentMethod;
  transactionDate: string;
  referenceNumber?: string;
  notes?: string;
}

/** Mirrors `AllocatePaymentLineDto`. */
export interface AllocatePaymentLinePayload {
  receivableId?: string;
  payableId?: string;
  amount: number;
}

/** Mirrors `AllocatePaymentDto` — `POST /finance/payments/:id/allocations`. */
export interface AllocatePaymentPayload {
  allocations: AllocatePaymentLinePayload[];
}

/**
 * Minimal read-only lookups for decorating a Receivable/Payable row with a human reference —
 * `Receivable`/`Payable` themselves carry only `saleId`/`purchaseId`/`expenseId` scalars (no join),
 * per those models' own "no generic Customer/Supplier entity yet" doc comments. Mirrors the exact
 * subset of `Sale`/`Purchase`/`Expense` fields the settlements table actually displays — not a full
 * `SaleWithLines`/etc. type, which would drag in every `SaleLine` detail type this ticket doesn't
 * need. See `use-finance-v2.ts#useSalesLookup`/`usePurchasesLookup`/`useExpensesLookup`'s own doc
 * comments for the N+1-avoidance strategy (one un-paginated list call each, like `AccountPicker`'s
 * own `listAccounts`).
 */
export interface SaleSummary {
  id: string;
  saleNumber: string;
  customerId: string | null;
  totalAmount: string;
  saleDate: string;
}

export interface PurchaseSummary {
  id: string;
  purchaseNumber: string;
  supplierId: string | null;
  totalAmount: string;
  purchaseDate: string;
}

export interface ExpenseSummary {
  id: string;
  category: string;
  description: string;
  amount: string;
  expenseDate: string;
}

/**
 * RAKHAL-356 additions below — Rakhal Balance projection, account update/archive, and Transfers.
 * Verified against the live backend source directly (`src/modules/finance-v2/accounts/**`), not
 * assumed from the design doc — money fields come back as `Prisma.Decimal` serialized to a JSON
 * **string** (e.g. `"12345.00"`), never a plain `number`, across every one of these shapes.
 */

/** Mirrors `UpdateFinancialAccountDto` — `PATCH /finance/accounts/:id`. Deliberately has **no**
 * `type` field: the backend DTO doesn't accept one at all (type is immutable after creation, per
 * `FINANCE_V2_DESIGN.md` §6's "an account with transactions is never deleted — archive it" spirit
 * extended to type too) — so there is nothing to strip client-side, the type simply isn't offered. */
export interface UpdateFinancialAccountPayload {
  name?: string;
  bankDetail?: Partial<CreateBankAccountDetailPayload>;
  mfsDetail?: Partial<CreateMfsAccountDetailPayload>;
}

/** `GET /finance/balance` response (`BalanceService.getRakhalBalance`). Every money field is a
 * Decimal-as-string. `receivablePayable.wired` is **still `false` today** — verified by reading
 * `BalanceService.getReceivablePayablePosition()` directly: despite `Receivable`/`Payable` v2
 * existing elsewhere (RAKHAL-340/348, both `DONE`), this specific endpoint was never re-pointed at
 * them and unconditionally returns a zeroed placeholder. Render `receivablePayable` as "not yet
 * available" rather than a fake ৳0 — do not treat `wired:false` as "the farm owes/is owed nothing." */
export interface RakhalBalanceAccountItem {
  id: string;
  name: string;
  type: FinancialAccountType;
  /** Decimal-as-string, e.g. `"1000.00"`. */
  balance: string;
}

export interface RakhalBalanceBreakdown {
  cash: string;
  bank: string;
  mfs: string;
}

export interface ReceivablePayablePosition {
  totalReceivable: string;
  totalPayable: string;
  wired: boolean;
  note: string;
}

export interface RakhalBalanceResult {
  rakhalBalance: string;
  breakdown: RakhalBalanceBreakdown;
  accounts: RakhalBalanceAccountItem[];
  receivablePayable: ReceivablePayablePosition;
}

/** Mirrors the `Transfer` row (`POST`/`GET /finance/transfers`). Field names confirmed against the
 * live `CreateTransferDto` — **not** `fromAccountId`/`toAccountId`/`description`, the real names are
 * `fromFinancialAccountId`/`toFinancialAccountId`/`notes`. */
export interface Transfer {
  id: string;
  farmId: string;
  fromFinancialAccountId: string;
  toFinancialAccountId: string;
  /** Decimal-as-string. */
  amount: string;
  /** Decimal-as-string, defaults `"0.00"`. */
  feeAmount: string;
  transactionDate: string;
  notes: string | null;
  createdById: string;
  createdAt: string;
}

/** Mirrors `CreateTransferDto` — `POST /finance/transfers`, permission `finance.transfer`
 * (owner-only since RAKHAL-353; a Manager gets a 403). */
export interface CreateTransferPayload {
  fromFinancialAccountId: string;
  toFinancialAccountId: string;
  amount: number;
  feeAmount?: number;
  transactionDate: string;
  notes?: string;
}

/**
 * RAKHAL-360 additions below — the "business document list" the redesigned Ledger view reads:
 * `Sale`/`Purchase`/`FinancePayment` (Transfer already modeled above by RAKHAL-356, reused as-is).
 * Verified against the live backend source (`sales/sale.prisma`, `purchasing/purchase.prisma`,
 * `sales/application/sale.service.ts`, `purchasing/application/purchase.service.ts`) — `GET /sales`
 * and `GET /purchasing/purchases` both return the parent row with every line's typed detail eagerly
 * loaded (`SALE_INCLUDE`/`PURCHASE_INCLUDE`), not a bare row, despite `SaleService.findAll`'s own
 * `Promise<Sale[]>` return-type annotation being stale (a pre-existing backend typing looseness, not
 * fixed here — out of a frontend ticket's lane). **No debit/credit anywhere in this section** — per
 * `FINANCE_V2_DESIGN.md` §9's explicit risk callout, these types carry only the plain business facts
 * (what was sold/bought/paid, when, how much, to/from whom); `LedgerAccount`/`JournalEntry` are never
 * modeled on the frontend at all.
 */
export type SaleLineType = "MILK" | "ANIMAL" | "INVENTORY" | "MANURE";
export type SaleStatus = "DRAFT" | "CONFIRMED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";

/** Mirrors `SaleLine` + whichever typed detail table `type` selects — only the fields the ledger's
 * description-building logic actually reads (real FKs, not resolved names — no `Customer`/generic
 * buyer entity exists yet, see `Sale.customerId`'s own doc comment; a cattle/medicine/feedItem/
 * equipment *name* would need a separate lookup this ticket's read-only ledger list doesn't attempt). */
export interface SaleLine {
  id: string;
  saleId: string;
  type: SaleLineType;
  description: string;
  quantity: string;
  unitId: string | null;
  unit: { id: string; name: string; symbol: string } | null;
  unitPrice: string;
  totalAmount: string;
  milkDetail: { id: string } | null;
  animalDetail: { id: string; cattleId: string } | null;
  inventoryDetail: { id: string; medicineId: string | null; feedItemId: string | null; equipmentId: string | null } | null;
  manureDetail: { id: string; notes: string | null } | null;
}

/** Mirrors `SaleWithLines` (`SaleService.findAll`/`findOne`). */
export interface Sale {
  id: string;
  farmId: string;
  saleNumber: string;
  customerId: string | null;
  saleDate: string;
  subtotal: string;
  discountAmount: string;
  totalAmount: string;
  status: SaleStatus;
  notes: string | null;
  createdById: string;
  createdAt: string;
  lines: SaleLine[];
}

/** Mirrors `PurchaseLine` (`purchasing/purchase.prisma`) — exactly one of `medicineId`/`feedItemId`/
 * `equipmentId` is set. */
export interface PurchaseLine {
  id: string;
  purchaseId: string;
  medicineId: string | null;
  feedItemId: string | null;
  equipmentId: string | null;
  quantity: string;
  unitCost: string;
  totalAmount: string;
}

/** Mirrors `PurchaseWithLines` (`PurchaseService.findAll`/`findOne`) — `payable` is included but
 * intentionally not modeled here (the ledger list shows `Purchase.totalAmount` only; a payable's own
 * outstanding/status belongs to RAKHAL-358's settlements screen, not this read-only document list). */
export interface Purchase {
  id: string;
  farmId: string;
  purchaseNumber: string;
  supplierId: string | null;
  purchaseDate: string;
  totalAmount: string;
  notes: string | null;
  createdById: string;
  createdAt: string;
  lines: PurchaseLine[];
}

/** Mirrors `Expense` (`purchasing/purchase.prisma`) — a farm operating cost that never becomes
 * inventory (§5.1's own worked example: "an electricity bill is an expense"), deliberately separate
 * from `Purchase`. */
export type ExpenseCategory = "SALARY" | "UTILITIES" | "BREEDING" | "TRANSFER_FEE" | "DEPRECIATION";

export interface Expense {
  id: string;
  farmId: string;
  category: ExpenseCategory;
  description: string;
  amount: string;
  expenseDate: string;
  financialAccountId: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
}
