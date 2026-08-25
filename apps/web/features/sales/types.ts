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
 * - **Manure, Inventory item, Animal** — `RecordManureSaleUseCase` (RAKHAL-347),
 *   `SellInventoryUseCase` (RAKHAL-346), `SellAnimalUseCase` (RAKHAL-345) all exist
 *   server-side (grepped their own module files: `sell-manure.module.ts`/`sales.module.ts`/
 *   `sell-animal.module.ts`) but **none of the three has an HTTP controller** — confirmed by
 *   grepping every `*.controller.ts` in the backend for a caller of any of the three; the only
 *   controller in `sales/presentation/controllers/` (`SaleController`) calls
 *   `SaleService.createSale` directly, which only persists a bare `DRAFT` `Sale` document with
 *   **no** journal posting, stock decrement, or `Receivable` — not the atomic use case a real sale
 *   needs. These three sale types are therefore UI-only in this ticket (form fields + validation,
 *   submit disabled) — see `components/record-sale-wizard.tsx`'s doc comment for the exact
 *   per-type gating. **Not faked.**
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

/** Which of the two real Finance V2 routes a given `RecordSaleType`/`ProductSaleSubtype`
 * combination is wired against — drives the wizard's per-type "coming soon" gating. */
export function isSaleFlowWired(type: RecordSaleType, productSubtype: ProductSaleSubtype | undefined): boolean {
  if (type === "OTHER_INCOME") return true;
  if (type === "PRODUCT") return productSubtype === "MILK";
  return false; // ANIMAL — SellAnimalUseCase has no HTTP route yet (RAKHAL-345)
}

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
