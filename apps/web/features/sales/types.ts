/**
 * RAKHAL-357 — Record Sale flow types (Finance V2, MILESTONE 21). Matched to the real backend
 * routes this ticket actually wires up — **not** every sale type `FINANCE_V2_DESIGN.md` §5.1
 * models. Confirmed by reading the live backend source directly (`Repos/rakhal-backend`), not by
 * assuming the design doc's model list is all callable yet:
 *
 * - **Milk** — `POST /milk/dispatch` (`MilkDispatchController`, RAKHAL-342/343). Real, live,
 *   already consumed by `features/buyers/api.ts#buyersApi.recordDispatch` — reused here rather
 *   than re-declared.
 * - **Other Income** — `POST /finance/income` + `GET /finance/income/categories`
 *   (`IncomeController`, RAKHAL-350). Real, live.
 * - **Payment / allocation** (for the Milk path's "Amount Received" step) —
 *   `POST /finance/payments` + `POST /finance/payments/:id/allocations`
 *   (`PaymentController`, RAKHAL-337). Real, live.
 * - **Manure** — `POST /sales/manure` (`RecordManureSaleUseCase`, RAKHAL-347/376). **Wired.**
 * - **Inventory item** — `POST /sales/inventory` (`SellInventoryUseCase`, RAKHAL-346/376). **Wired.**
 * - **Animal** — `SellAnimalUseCase` (RAKHAL-345) is now wired: `POST /sales/animal/:cattleId`
 *   (RAKHAL-399, `animal-sale.controller.ts`). **Wired.**
 *
 * RAKHAL-388 (MILESTONE 22): all 5 sale types now have a real route — `isSaleFlowWired`'s
 * per-type "coming soon" gate is deleted (see git history for the removed function).
 */

import type { PaymentMethod } from "@/lib/types/payment";

export type { PaymentMethod };

/** Top-level sale type — Step 1 of the wizard. Mirrors the ticket's own "Product / Animal / Other
 * Income" framing (replaces V1's `Milk | Animal | Manure | Others` pills). */
export const RECORD_SALE_TYPES = ["PRODUCT", "ANIMAL", "OTHER_INCOME"] as const;
export type RecordSaleType = (typeof RECORD_SALE_TYPES)[number];

/** "Product Sale" sub-type — which product is being sold. Only `MILK` has a real backend route
 * today (see this file's top doc comment); `MANURE`/`INVENTORY` are shown but blocked. */
export const PRODUCT_SALE_SUBTYPES = ["MILK", "MANURE", "INVENTORY"] as const;
export type ProductSaleSubtype = (typeof PRODUCT_SALE_SUBTYPES)[number];

/** RAKHAL-361 — pre-fill for `RecordSaleDialog` when opened from a domain entry point (Cattle
 * profile "Sell", Milk area "Sell Milk", Inventory item "Sell") instead of the standalone `/sales`
 * trigger. Only seeds Step 1's own fields — never skips the wizard, since Amount/Payment still need
 * the farmer's input either way. */
export interface RecordSaleInitial {
  type?: RecordSaleType;
  productSubtype?: ProductSaleSubtype;
  cattleId?: string;
  cattleLabel?: string;
  /** Pre-fills the free-text Manure/Inventory description field with the source item's own name
   * (e.g. a Medicine/FeedItem/Equipment row's "Sell" action) — the wizard has no item-id FK field
   * for this sub-type today (see this file's top doc comment: `SellInventoryUseCase` has no route
   * yet), so a name string is the honest, non-fabricated pre-fill. */
  description?: string;
}

/** RAKHAL-343 — `GET /milk/availability`. Read-only display snapshot; the real concurrency-safe
 * check happens server-side inside `SellMilkUseCase` at dispatch time (row lock). */
export interface MilkTankAvailability {
  tankId: string;
  tankName: string;
  availableL: number;
  totalCapacityL: number;
}

export interface MilkAvailabilityResult {
  tanks: MilkTankAvailability[];
  totalAvailableL: number;
}

/** Mirrors `IncomeCategory` (`GET /finance/income/categories`). */
export interface IncomeCategory {
  id: string;
  name: string;
  isSystem: boolean;
  farmId: string | null;
  createdAt: string;
}

/** Mirrors `CreateIncomeCategoryDto` — `POST /finance/income/categories`. */
export interface CreateIncomeCategoryPayload {
  name: string;
}

/** Mirrors `RecordOtherIncomeDto` — `POST /finance/income`. Always posts in full, immediately, to
 * one account — there is no partial/"Due" concept for Other Income (`FINANCE_V2_DESIGN.md` §5.1:
 * "revenue-first", not a `Sale`/`Receivable`). */
export interface RecordOtherIncomePayload {
  categoryId: string;
  description?: string;
  amount: number;
  date: string;
  financialAccountId: string;
}

/** Mirrors `OtherIncome`. */
export interface OtherIncomeResult {
  id: string;
  categoryId: string;
  description: string | null;
  amount: number;
  date: string;
  financialAccountId: string;
  createdAt: string;
}

/** Mirrors `Receivable` + its derived `outstanding`/`status` (`ReceivableWithDerived`,
 * `GET /finance/receivables`). Used only to look up the `Receivable` a just-created milk sale
 * raised, so the wizard's "Amount Received" step can allocate a payment against it — no
 * dedicated `GET /finance/receivables?saleId=` filter exists server-side (grepped
 * `ListReceivablesQueryDto` — only `customerId`/`dueBefore`/`dueAfter`). `customerId` looked like
 * the right filter but is dead against the real data — see `api.ts#listRecentReceivables`'s doc
 * comment for the live-verified reason (`Receivable.customerId` is never actually persisted) —
 * so the lookup instead fetches the newest few receivables, unfiltered, and matches `saleId`
 * client-side. */
export interface ReceivableSummary {
  id: string;
  farmId: string;
  saleId: string;
  customerId: string | null;
  totalAmount: number;
  dueDate: string | null;
  closedAt: string | null;
  outstanding: string;
  status: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
}

/** Mirrors `SellAnimalDto` — `POST /sales/animal/:cattleId` (RAKHAL-345/399). */
export interface SellAnimalPayload {
  salePrice: number;
  buyerName?: string;
  buyerId?: string;
  financialAccountId?: string;
  paymentMethod?: PaymentMethod;
  amountReceived?: number;
  saleDate: string;
}

/** Mirrors `SellAnimalResult`. */
export interface SellAnimalResult {
  saleId: string;
  saleNumber: string;
  totalAmount: string;
  dispositionId: string;
  receivableId: string;
  paymentId: string | null;
  journalTransactionId: string;
}

export type PaymentDirection = "INCOMING" | "OUTGOING";

/** Mirrors `CreatePaymentDto` — `POST /finance/payments`. */
export interface CreatePaymentPayload {
  direction: PaymentDirection;
  financialAccountId: string;
  amount: number;
  method: PaymentMethod;
  transactionDate: string;
  referenceNumber?: string;
  notes?: string;
}

export interface PaymentResult {
  id: string;
  farmId: string;
  direction: PaymentDirection;
  financialAccountId: string;
  amount: number;
  method: PaymentMethod;
  transactionDate: string;
  createdAt: string;
}

/** Mirrors `AllocatePaymentDto` — `POST /finance/payments/:id/allocations`. */
export interface AllocatePaymentPayload {
  allocations: { receivableId?: string; payableId?: string; amount: number }[];
}

/** Mirrors `SellInventoryDto` — `POST /sales/inventory` (RAKHAL-346/376). */
export interface SellInventoryPayload {
  itemType: "MEDICINE" | "FEED_ITEM" | "EQUIPMENT";
  itemId: string;
  quantity: number;
  unitPrice: number;
  discountAmount?: number;
  notes?: string;
  saleDate: string;
  financialAccountId?: string;
  amountReceived?: number;
  paymentMethod?: PaymentMethod;
}

/** Mirrors `SellInventoryItemResult` — `sale`'s useful fields only (`SaleWithLines` in full is
 * more than this wizard's success toast needs). */
export interface SellInventoryResult {
  sale: { id: string; saleNumber: string; totalAmount: string };
}

/** Mirrors `SellManureDto` — `POST /sales/manure` (RAKHAL-347/376). `quantity`/`unitId` stay
 * optional server-side (RD-058: no manure production/stock model) — this form never sets them. */
export interface SellManurePayload {
  totalAmount: number;
  financialAccountId?: string;
  amountReceived?: number;
  paymentMethod?: PaymentMethod;
  saleDate: string;
  notes?: string;
}

export interface SellManureResult {
  sale: { id: string; saleNumber: string; totalAmount: string };
}

/** RAKHAL-388 — `GET /sales` v2 filters (RAKHAL-368's `ListSalesQueryDto`). `paymentStatus`
 * reuses the same 4-state `ReceivableStatus` enum the backend does (UNPAID/PARTIALLY_PAID/PAID/
 * OVERDUE) — the Invoices screen's 4 tabs map to `undefined`/`UNPAID`/`PARTIALLY_PAID`/`PAID`; an
 * `OVERDUE` row only surfaces under the `All` tab, its own Status cell still reads "Overdue". */
export type InvoicePaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";

export interface InvoiceListFilters {
  from?: string;
  to?: string;
  paymentStatus?: InvoicePaymentStatus;
  q?: string;
}

export type SaleLineType = "MILK" | "ANIMAL" | "INVENTORY" | "MANURE";

/** One `GET /sales` v2 row (`SaleListRow`, RAKHAL-368). */
export interface InvoiceRow {
  id: string;
  saleNumber: string;
  saleDate: string;
  status: "DRAFT" | "CONFIRMED" | "CANCELLED" | "REFUNDED" | "PARTIALLY_REFUNDED";
  customer: { id: string; name: string } | null;
  totalAmount: string;
  paidAmount: string;
  dueAmount: string;
  paymentStatus: InvoicePaymentStatus;
  dueDate: string | null;
  lineSummary: { type: SaleLineType | null; description: string | null; quantity: number };
}

/** `GET /sales/summary?from&to&granularity` (RAKHAL-374). */
interface PeriodMetric {
  current: number;
  previous: number;
  changePct: number | null;
}

export type SalesTrendGranularity = "day" | "week" | "month";

export interface SalesSummary {
  period: { from: string; to: string };
  previousPeriod: { from: string; to: string };
  kpis: {
    totalSales: PeriodMetric;
    totalInvoices: PeriodMetric;
    paidAmount: PeriodMetric;
    outstanding: PeriodMetric;
  };
  trend: { bucket: string; amount: string }[];
  byProduct: { lineType: SaleLineType; amount: string; sharePct: number }[];
  topBuyers: { customerId: string; name: string; amount: string; invoiceCount: number }[];
}

/** RAKHAL-388 — `GET /buyers/dispatches` v2 filters (RAKHAL-378's `DispatchQueryDto`). Lives here
 * (not `features/buyers/**`) since Dispatches is a Sales-module tab per the Business IA
 * (`BUSINESS_IA_PRD.md` §5.8) — deliberately not reusing `features/buyers/types.ts#Dispatch`,
 * which mirrors the older `GET /milk/dispatch` shape and is missing `dispatchNumber`/`status`. */
export type DispatchStatus = "PENDING" | "DELIVERED" | "CANCELLED";

export interface DispatchListFilters {
  buyerId?: string;
  from?: string;
  to?: string;
  status?: DispatchStatus;
}

export interface DispatchRow {
  id: string;
  dispatchNumber: string;
  buyerId: string;
  buyer: { id: string; name: string } | null;
  dispatchedAt: string;
  volumeDispatchedL: number;
  volumeReceivedL: number | null;
  driverName: string | null;
  calculatedAmount: number;
  saleId: string | null;
  cancelledAt: string | null;
  status: DispatchStatus;
}

/** `GET /buyers/dispatches/summary` (RAKHAL-378). */
export interface DispatchesSummary {
  total: number;
  delivered: { count: number; pct: number };
  inTransit: { count: number; pct: number };
  cancelled: { count: number; pct: number };
}

/** Mirrors `RecordReceiptDto` — `PATCH /buyers/dispatches/:id/receipt`. */
export interface RecordReceiptPayload {
  volumeReceivedL: number;
  driverName?: string;
}
