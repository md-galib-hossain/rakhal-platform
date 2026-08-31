/**
 * RAKHAL-359 — Purchasing types, matched to the live backend (`Repos/rakhal-backend/src/modules/
 * purchasing/**`, RAKHAL-348/349, `FINANCE_V2_DESIGN.md` §5.1). Real routes, not mocked — verified
 * against `purchase.controller.ts`/`expense.controller.ts`/`payable.controller.ts` directly.
 *
 * A `Purchase` always increases an inventory asset (Medicine/FeedItem/Equipment stock). An `Expense`
 * is consumed immediately and never becomes stock. Deliberately separate flows — see this feature's
 * own `docs/IN_FLIGHT.md` entry for the full reasoning.
 */

export const EXPENSE_CATEGORIES = ["SALARY", "UTILITIES", "BREEDING", "TRANSFER_FEE", "DEPRECIATION"] as const;
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

/** `ExpenseCategory` -> seeded `LedgerAccount.code` (RAKHAL-333's default chart, 5xxx range) —
 * mirrors `EXPENSE_CATEGORY_LEDGER_CODE` in `expense.service.ts` exactly. Internal-only (the ledger
 * is never farmer-facing, `FINANCE_V2_DESIGN.md` §4.4/§9) — used only for the small "posts to X"
 * caption on the category select, never as a real accounting surface. Deliberately does **not**
 * offer an "Other" category: the backend enum has no OTHER value (no ledger account exists for one —
 * RD-060 — so offering it client-side would just produce a 400 the farmer can't explain). */
export const EXPENSE_CATEGORY_LEDGER_CODE: Record<ExpenseCategory, string> = {
  SALARY: "5200",
  UTILITIES: "5400",
  BREEDING: "5300",
  TRANSFER_FEE: "5500",
  DEPRECIATION: "5600",
};

export interface Expense {
  id: string;
  farmId: string;
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string;
  financialAccountId: string | null;
  notes: string | null;
  createdById: string;
  createdAt: string;
  /** RAKHAL-392 — `Expense` has no `status` enum (unlike `Purchase.status`); void is tracked by
   * this timestamp instead (`VoidDocumentUseCase.voidExpense`). `null` means Posted. */
  voidedAt: string | null;
}

export interface RecordExpensePayload {
  category: ExpenseCategory;
  description: string;
  amount: number;
  expenseDate: string;
  /** Set to pay in full immediately from this account. Omit to raise the full amount as a `Payable`. */
  financialAccountId?: string;
  dueDate?: string;
  notes?: string;
}

/** Exactly one of `medicineId`/`feedItemId`/`equipmentId` — enforced server-side
 * (`validatePurchaseLineDetailShape`). */
export interface PurchaseLine {
  id: string;
  purchaseId: string;
  medicineId: string | null;
  feedItemId: string | null;
  equipmentId: string | null;
  quantity: number;
  unitCost: number;
  totalAmount: number;
  createdAt: string;
}

/** Raw `Payable` row as embedded on `Purchase.payable` (`PURCHASE_INCLUDE`) — **not** the derived
 * `outstanding`/`status` shape `GET /purchasing/payables` returns (see `PayableWithDerived` below).
 * A purchase/expense paid in full at creation has `payable: null`. */
export interface EmbeddedPayable {
  id: string;
  farmId: string;
  purchaseId: string | null;
  expenseId: string | null;
  supplierId: string | null;
  totalAmount: number;
  dueDate: string | null;
  closedAt: string | null;
  createdAt: string;
}

export type PurchaseStatus = "CONFIRMED" | "VOIDED";

export interface Purchase {
  id: string;
  farmId: string;
  purchaseNumber: string;
  supplierId: string | null;
  purchaseDate: string;
  totalAmount: number;
  notes: string | null;
  createdById: string;
  createdAt: string;
  /** RAKHAL-367/392 — `Purchase.status` (`@default(CONFIRMED)`). */
  status: PurchaseStatus;
  lines: PurchaseLine[];
  payable: EmbeddedPayable | null;
}

/** List-row shape — `findAll` returns bare `Purchase[]` (no `lines`/`payable` include). */
export type PurchaseListRow = Omit<Purchase, "lines" | "payable">;

export interface CreatePurchaseLinePayload {
  medicineId?: string;
  feedItemId?: string;
  equipmentId?: string;
  quantity: number;
  unitCost: number;
}

export interface CreatePurchasePayload {
  supplierId?: string;
  purchaseDate: string;
  notes?: string;
  lines: CreatePurchaseLinePayload[];
  /** How much of the computed total is paid immediately. Omitted/0 raises the full total as a `Payable`. */
  paidAmount?: number;
  /** The `FinancialAccount` `paidAmount` is paid from. Required whenever `paidAmount` > 0. */
  financialAccountId?: string;
  dueDate?: string;
}

export const PAYABLE_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID", "OVERDUE"] as const;
export type PayableStatus = (typeof PAYABLE_STATUSES)[number];

/** `GET /purchasing/payables` row — derived `outstanding`/`status`, never stored server-side
 * (`FINANCE_V2_DESIGN.md` §4.6). Used here only to cross-reference a purchase/expense's own payable
 * by `purchaseId`/`expenseId` (the list endpoint has no such filter — see this feature's `api.ts`
 * doc comment on `listPayablesFor`). */
export interface PayableWithDerived {
  id: string;
  farmId: string;
  purchaseId: string | null;
  expenseId: string | null;
  supplierId: string | null;
  totalAmount: number;
  outstanding: string;
  status: PayableStatus;
  dueDate: string | null;
  closedAt: string | null;
  createdAt: string;
}

/** Item type a `PurchaseLine`/inventory increment can target — mirrors the 3-way
 * `medicineId`/`feedItemId`/`equipmentId` exclusivity `validatePurchaseLineDetailShape` enforces. */
export type PurchasableItemKind = "MEDICINE" | "FEED_ITEM" | "EQUIPMENT";

/** Common shape the item picker needs, regardless of which inventory table it's really reading
 * from — `Medicine`/`FeedItem`/`Equipment` all carry `id`/`name`/`currentStock`/`unit.symbol`
 * (Equipment's `unit` is nullable — see `features/inventory/types.ts`). */
export interface PurchasableItemOption {
  id: string;
  name: string;
  currentStock: number;
  unitSymbol: string;
}

/** RAKHAL-391 (MILESTONE 22) — `GET /purchasing/purchases`/`/purchasing/expenses` v2 filters
 * (RAKHAL-375's `ListPurchasesQueryDto`/`ListExpensesQueryDto`, both `CursorPaginationQueryDto`
 * subclasses). `paymentStatus` reuses `PayableStatus` — a real SQL `WHERE`, never post-filtering. */
export interface PurchasingListFilters {
  from?: string;
  to?: string;
  supplierId?: string;
  paymentStatus?: PayableStatus;
}

export type ExpensesListFilters = PurchasingListFilters & { category?: ExpenseCategory };

interface PeriodMetric {
  current: number;
  previous: number;
  changePct: number | null;
}

/** `GET /purchasing/summary?from&to` (RAKHAL-375) — the AC's "This Month Summary": Total
 * Purchases / Paid Amount / Payable / Purchase Orders, each with `previous`/`changePct`. */
export interface PurchasingSummary {
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  kpis: {
    totalPurchases: PeriodMetric;
    paidAmount: PeriodMetric;
    payable: PeriodMetric;
    purchaseOrders: PeriodMetric;
  };
}
