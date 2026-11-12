/**
 * Milk Buyers & Dispatch types — matched directly to `buyer.controller.ts`/`milk-dispatch.
 * controller.ts`/`buyer.service.ts` response shapes (Repos/rakhal-backend, PRD §11 / API §7). No
 * Figma frames supplied for this module (RFE-026's own note: "Design: Figma if present, else
 * PRD-spec") — built against the real backend contract.
 */

export type BuyerType = "DAIRY_COMPANY" | "COOPERATIVE" | "LOCAL_TRADER" | "DIRECT_CONSUMER";
/**
 * RAKHAL-355: re-exported from the new canonical `@/lib/types/payment` instead of the local
 * 3-value literal this used to be. Zero runtime/shape risk — the values were already identical
 * (CASH/BANK_TRANSFER/MFS, already missing WALLET, "ironically closest to correct already" per the
 * ticket) — and grep confirms this type isn't actually consumed as a field anywhere in
 * `features/buyers/**` today (no `paymentMethod` field on any buyer/dispatch interface), so this is
 * a type-only consolidation with no behavior change to the live `POST /milk/dispatch` flow.
 */
import type { PaymentMethod as FinancePaymentMethod } from "@/lib/types/payment";
export type { FinancePaymentMethod };

export interface Buyer {
  id: string;
  farmId: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  buyerType: BuyerType;
  paymentTermsDays: number;
  basePricePerLitre: number;
  baseFatPct: number;
  fatBonusPer01Pct: number;
  sccThreshold: number;
  sccPenaltyPer100k: number;
  collectionDays: string[];
  collectionTime: string | null;
  bankDetails: string | null;
  /** RAKHAL-389 — corrected from a stale `isActive: boolean` that never matched the real schema:
   * `MilkBuyer` (`prisma/schemas/buyer/buyer.prisma`) soft-deletes via `deletedAt`, not `isActive` —
   * that field never existed server-side, so every buyer silently rendered "Inactive" everywhere
   * this was read. Read directly off the schema, not assumed. */
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BuyerListFilters {
  search?: string;
  /** Matches `ListBuyerQueryDto.includeArchived` exactly — was misnamed `includeInactive` and sent
   * as a param the backend never read (`GET /buyers` always excluded archived buyers regardless of
   * what this flag held). Fixed alongside the `isActive` correction above. */
  includeArchived?: boolean;
}

/** One `GET /buyers` v2 list row (`BuyerService.listBuyers`, RAKHAL-372) — the plain `Buyer` fields
 * plus 4 aggregate columns computed server-side, never re-derived client-side. */
export interface BuyerListRow extends Buyer {
  totalPurchased: string;
  lastPurchaseAt: string | null;
  outstanding: string;
  status: "ACTIVE" | "INACTIVE";
}

/** `GET /buyers/summary` (RAKHAL-372) — the AC's 4-stat Buyer Summary. */
export interface BuyersSummary {
  totalBuyers: number;
  activeBuyers: number;
  totalSales: string;
  totalOutstanding: string;
}

/** One `GET /sales?customerId=` row for the buyer detail page's "Sales & Invoices" tab — a
 * narrower local mirror of `features/sales/types.ts#InvoiceRow` (RAKHAL-368's `SaleListRow`)
 * rather than a cross-feature type import, keeping this ticket's lane self-contained. */
export interface BuyerInvoiceRow {
  id: string;
  saleNumber: string;
  saleDate: string;
  totalAmount: string;
  paidAmount: string;
  dueAmount: string;
  paymentStatus: "UNPAID" | "PARTIALLY_PAID" | "PAID" | "OVERDUE";
  dueDate: string | null;
}

/** `GET /buyers/:id/overview` (RAKHAL-372) — buyer detail page header stats + Overview tab panels. */
export interface BuyerOverview {
  outstandingAmount: string;
  totalPurchasedThisYear: string;
  lastPayment: { amount: string; date: string } | null;
  recentInvoices: { id: string; saleNumber: string; saleDate: string; totalAmount: string; status: string }[];
  info: {
    phone: string | null;
    address: string | null;
    paymentTermsDays: number;
    basePricePerLitre: number;
    buyerType: BuyerType;
  };
}

/** Mirrors `CreateBuyerDto` (also reused for update — `UpdateBuyerDto` is the same shape, all optional). */
export interface CreateBuyerPayload {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  buyerType: BuyerType;
  paymentTermsDays?: number;
  basePricePerLitre: number;
  baseFatPct?: number;
  fatBonusPer01Pct?: number;
  sccThreshold?: number;
  sccPenaltyPer100k?: number;
  collectionDays?: string[];
  collectionTime?: string;
  bankDetails?: string;
}

export type UpdateBuyerPayload = Partial<CreateBuyerPayload>;

export interface MilkPriceBreakdown {
  baseAmount: number;
  fatBonus: number;
  sccPenalty: number;
  total: number;
}

/** Derived-only (not a stored column) — mirrors the backend's `DispatchStatus`
 * (`domain/dispatch-status.ts`). Duplicated locally rather than imported from `features/sales/**`
 * — a 3-value literal union, same "no cross-feature type coupling for a trivial enum" judgment
 * call `PayableStatus` makes on the backend side. */
export type DispatchStatus = "PENDING" | "DELIVERED" | "CANCELLED";

export interface Dispatch {
  id: string;
  farmId: string;
  buyerId: string;
  buyer?: { id: string; name: string };
  /** RAKHAL-366/389 — `DSP-NNNNNN`, real since MILESTONE 22 (`GET /milk/dispatch`/`GET
   * /buyers/dispatches` share the same underlying `BuyerService.listDispatches` call). */
  dispatchNumber: string;
  driverName: string | null;
  status: DispatchStatus;
  dispatchedAt: string;
  volumeDispatchedL: number;
  volumeReceivedL: number | null;
  fatPct: number | null;
  scc: number | null;
  discrepancyL: number | null;
  discrepancyFlagged: boolean;
  basePricePerLitre: number;
  fatBonus: number;
  sccPenalty: number;
  calculatedAmount: number;
  paymentDueDate: string | null;
  paidAmount: number;
  notes: string | null;
  createdAt: string;
}

export interface DispatchListFilters {
  buyerId?: string;
  from?: string;
  to?: string;
}

/** Mirrors `RecordDispatchDto` — `POST /milk/dispatch`. */
export interface RecordDispatchPayload {
  buyerId: string;
  dispatchedAt: string;
  volumeDispatchedL: number;
  volumeReceivedL?: number;
  fatPct?: number;
  scc?: number;
  notes?: string;
  /** Money taken at the point of sale — posts the payment in the same transaction as the sale.
   * Omit for a credit sale. `paymentMethod` is required whenever this is > 0. */
  amountReceived?: number;
  paymentMethod?: FinancePaymentMethod;
}

export interface RecordDispatchResult {
  id: string;
  dispatchNumber: string;
  amountReceived: number;
  buyerName: string;
  volumeDispatchedL: number;
  volumeReceivedL: number | null;
  discrepancyL: number | null;
  discrepancyFlagged: boolean;
  calculatedAmount: number;
  priceBreakdown: MilkPriceBreakdown;
  paymentDueDate: string | null;
  tankUpdated: boolean;
  /**
   * RAKHAL-357 — corrected from a stale `financeTransactionId: string | null` field that never
   * matched the real backend response even before Finance V2: `BuyerService.recordDispatch`
   * (`buyer.service.ts`) returns `saleId` (the `Sale` `SellMilkUseCase` created, RAKHAL-342/343),
   * not a `financeTransactionId` — that field never existed server-side for this route. Read
   * directly off `buyer.service.ts`'s own return statement, not assumed. `null` only for a
   * zero-volume dispatch (logged for record purposes only, posts no sale at all).
   */
  saleId: string | null;
}

export interface BuyerStatement {
  buyer: { id: string; name: string };
  month: string;
  totalDispatchedL: number;
  totalReceivedL: number;
  baseAmount: number;
  qualityAdjustments: number;
  totalDue: number;
  totalPaid: number;
  outstanding: number;
  dispatches: Dispatch[];
}

/** Buyer detail page tabs (`BUSINESS_IA_PRD.md` §5.11). */
export const BUYER_DETAIL_TABS = ["overview", "sales", "dispatches", "payments", "balance"] as const;
export type BuyerDetailTabKey = (typeof BUYER_DETAIL_TABS)[number];
