/**
 * Milk Buyers & Dispatch types — matched directly to `buyer.controller.ts`/`milk-dispatch.
 * controller.ts`/`buyer.service.ts` response shapes (Repos/rakhal-backend, PRD §11 / API §7). No
 * Figma frames supplied for this module (RFE-026's own note: "Design: Figma if present, else
 * PRD-spec") — built against the real backend contract.
 */

export type BuyerType = "DAIRY_COMPANY" | "COOPERATIVE" | "LOCAL_TRADER" | "DIRECT_CONSUMER";
export type FinancePaymentMethod = "CASH" | "BANK_TRANSFER" | "MFS";

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
  financeTransactionId: string | null;
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
