/**
 * Finance types — matched directly to `finance.controller.ts`/`finance.service.ts` response shapes
 * (Repos/rakhal-backend), NOT the aspirational `Rakhal_API.md` §12/PRD §16 shape. Real gaps vs the
 * Figma "Finance" frames, flagged not faked: `FinanceLoan` has no `dueDate` field at all (only
 * `startDate`/`durationMonths`) — Liabilities' table uses "Start Date" instead of the mock's "Due
 * Date"; `highlights()` has no per-litre *margin* (no selling price tracked here, only cost) — the
 * KPI shows the real `costPerLitreThisMonth` instead of the mock's "Net Margin per Liter"/"AQR:
 * 92.5" (no AQR figure exists on this endpoint); `herdMarketValue` is a real field but always `0`
 * server-side (no per-animal market-value model yet — `finance.service.ts` comment confirms this is
 * deferred), rendered honestly as ৳0 rather than the mock's fabricated ৳1,250,000; there is no
 * `GET /finance/transactions/export` route despite `PROJECT_PROGRESS.md`'s RFE-035 description
 * mentioning one — the ledger's Export button renders per Figma but stays disabled.
 */

export type FinanceTxnType = "OPERATING_EXPENSE" | "INVENTORY_PURCHASE" | "REVENUE" | "DEBT_LOAN";
export type FinanceCategory = "REVENUE" | "INVENTORY" | "HEALTHCARE" | "OVERHEAD" | "DEBT";
export type FinancePaymentMethod = "CASH" | "BANK_TRANSFER" | "MFS";
export type FinanceTxnStatus = "COMPLETED" | "PENDING" | "VOIDED";
export type ReceivableKind = "RECEIVABLE" | "PAYABLE";
export type ReceivableStatus = "PENDING" | "PARTIAL" | "COMPLETED" | "OVERDUE";
export type LoanStatus = "ACTIVE" | "CLOSED";
export type FixedAssetCategory = "EQUIPMENT" | "VEHICLE" | "BUILDING" | "OTHER";
export type SurvivalRunwayStatus = "healthy" | "warning" | "critical" | "unknown";

export interface FinanceHighlights {
  availableLiquidity: number;
  costPerLitreThisMonth: number | null;
  herdMarketValue: number;
  survivalRunwayDays: number | null;
  survivalRunwayStatus: SurvivalRunwayStatus;
}

export interface LedgerTransaction {
  id: string;
  reference: string;
  date: string;
  type: FinanceTxnType;
  category: FinanceCategory;
  subType: string | null;
  entityName: string | null;
  description: string | null;
  amount: number;
  paidNow: number;
  paymentType: "FULL" | "PARTIAL";
  paymentMethod: FinancePaymentMethod;
  status: FinanceTxnStatus;
  isVoided: boolean;
  createdAt: string;
}

export interface LedgerChartMonth {
  month: string; // "2026-07"
  income: number;
  expense: number;
  profit: number;
}

export interface LedgerChart {
  yearly: LedgerChartMonth[];
  operatingMarginPct: number;
  debtToAssetPct: number;
}

export interface LedgerListFilters {
  from?: string;
  to?: string;
  category?: FinanceCategory;
  status?: FinanceTxnStatus;
  search?: string;
}

export interface Settlement {
  id: string;
  reference: string;
  kind: ReceivableKind;
  entityName: string | null;
  total: number;
  paid: number;
  outstanding: number;
  dueDate: string | null;
  status: ReceivableStatus;
  createdAt: string;
}

export interface SettlementStats {
  totalOutstanding: number;
  pendingToday: number;
  overdue: number;
}

export interface SettlementListFilters {
  status?: ReceivableStatus;
  search?: string;
}

export interface Loan {
  id: string;
  entityName: string;
  total: number;
  paid: number;
  outstanding: number;
  monthlyEmi: number;
  status: LoanStatus;
}

export interface LiabilitiesResponse {
  stats: { totalDebt: number; monthlyEmi: number };
  loans: Loan[];
}

export interface AssetAllocationSlice {
  category: "cattle_herd" | "equipment" | "land_structure" | "inventory" | "cash_bank";
  value: number;
  color: string;
}

export interface AssetDepreciationRow {
  asset_name: string;
  book_value: number;
  accumulated_depreciation: number;
  useful_life_years: number;
  purchase_value: number;
}

export interface AssetsResponse {
  allocation: AssetAllocationSlice[];
  totalAssets: number;
  totalLiabilities: number;
  totalNetWorth: number;
  depreciation: AssetDepreciationRow[];
}

export interface WalletTransactionItem {
  id: string;
  reference: string;
  type: "credit" | "debit";
  description: string | null;
  paymentMethod: FinancePaymentMethod;
  amount: number;
  date: string;
}

export interface WalletResponse {
  totalBalance: number;
  transactions: WalletTransactionItem[];
}

export interface AddFundsPayload {
  amount: number;
  paymentMethod?: FinancePaymentMethod;
  description?: string;
  date?: string;
}

export interface WithdrawPayload {
  fundName: string;
  amount: number;
  paymentMethod?: FinancePaymentMethod;
  date?: string;
}

/** Mirrors `CreateTransactionDto` — one shape covers all 4 wizard types, the backend validates the
 * type-specific fields it actually needs. */
export interface CreateTransactionPayload {
  type: FinanceTxnType;
  category: FinanceCategory;
  subType?: string;
  entityName?: string;
  notes?: string;
  amount: number;
  paymentType?: "FULL" | "PARTIAL";
  paidNow?: number;
  paymentMethod?: FinancePaymentMethod;
  paymentDate?: string;
  dueDate?: string;
  buyerId?: string;
  cattleId?: string;
  inventoryItemName?: string;
  quantity?: number;
  costPerUnit?: number;
  monthlyEmi?: number;
  startDate?: string;
  durationMonths?: number;
  loanId?: string;
}

export interface CreateTransactionResult {
  transactionId: string;
  reference: string;
  amount: number;
  status: FinanceTxnStatus;
  receivableCreated: string | null;
  payableCreated: string | null;
  loanCreated: string | null;
  cattleStatusUpdated: string | null;
  inventoryUpdated: boolean;
}

/** Figma "Finance" frame's tab bar (node 1039:33905/34108, file `SCfMPdxP6vgW1uTxfqCtz7`), in
 * on-screen order. Wallet is a separate header button, not a 6th tab — no Figma frame for it was
 * supplied this pass. */
export const FINANCE_TABS = [
  { key: "ledger" },
  { key: "receivables" },
  { key: "payables" },
  { key: "liabilities" },
  { key: "assets" },
] as const;

export type FinanceTabKey = (typeof FINANCE_TABS)[number]["key"];
