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
export type { PaymentMethod as FinancePaymentMethod } from "@/lib/types/payment";

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
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BuyerListFilters {
  search?: string;
  includeInactive?: boolean;
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

export interface Dispatch {
  id: string;
  farmId: string;
  buyerId: string;
  buyer?: { id: string; name: string };
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
}

export interface RecordDispatchResult {
  id: string;
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

export const BUYER_TABS = [{ key: "buyers" }, { key: "dispatches" }] as const;
export type BuyerTabKey = (typeof BUYER_TABS)[number]["key"];
