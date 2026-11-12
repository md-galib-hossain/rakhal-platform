"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  AllocatePaymentPayload,
  CreateIncomeCategoryPayload,
  CreatePaymentPayload,
  DispatchListFilters,
  DispatchRow,
  DispatchesSummary,
  IncomeCategory,
  InvoiceListFilters,
  InvoiceRow,
  MilkAvailabilityResult,
  OtherIncomeResult,
  PaymentResult,
  ReceivableSummary,
  RecordOtherIncomePayload,
  RecordReceiptPayload,
  SalesSummary,
  SalesTrendGranularity,
  SellAnimalPayload,
  SellAnimalResult,
  SellInventoryPayload,
  SellInventoryResult,
  SellManurePayload,
  SellManureResult,
} from "./types";

/**
 * RAKHAL-357 — Record Sale flow API functions, live against the real Finance V2 routes this
 * ticket actually wires up (see `types.ts`'s top doc comment for which sale types are real vs
 * blocked). Milk itself reuses `features/buyers/api.ts#buyersApi.recordDispatch` +
 * `useBuyersPagedList`/`useRecordDispatch` rather than re-declaring `POST /milk/dispatch` here —
 * house convention is to search before creating, and that hook is already the live, tested path.
 */
export const salesApi = {
  /** `GET /milk/availability` (RAKHAL-343). */
  milkAvailability(tankId?: string): Promise<MilkAvailabilityResult> {
    return apiFetch<MilkAvailabilityResult>("/milk/availability", { searchParams: { tankId } });
  },

  /** `POST /sales/animal/:cattleId` (RAKHAL-345/399) — the real atomic animal-sale flow:
   * `Sale`+`CattleDisposition`+ledger posting+optional `Payment`, all in one server transaction. */
  sellAnimal(cattleId: string, dto: SellAnimalPayload): Promise<SellAnimalResult> {
    return apiFetch<SellAnimalResult>(`/sales/animal/${cattleId}`, { method: "POST", body: dto });
  },

  /** `GET /finance/income/categories` (RAKHAL-350). */
  listIncomeCategories(): Promise<IncomeCategory[]> {
    return apiFetch<IncomeCategory[]>("/finance/income/categories");
  },

  /** `POST /finance/income/categories` — farm-custom category quick-add. */
  createIncomeCategory(dto: CreateIncomeCategoryPayload): Promise<IncomeCategory> {
    return apiFetch<IncomeCategory>("/finance/income/categories", { method: "POST", body: dto });
  },

  /** `POST /finance/income` — records + posts in one call, no separate payment step. */
  recordOtherIncome(dto: RecordOtherIncomePayload): Promise<OtherIncomeResult> {
    return apiFetch<OtherIncomeResult>("/finance/income", { method: "POST", body: dto });
  },

  /** `POST /finance/payments` (RAKHAL-337) — records the money movement itself. */
  createPayment(dto: CreatePaymentPayload): Promise<PaymentResult> {
    return apiFetch<PaymentResult>("/finance/payments", { method: "POST", body: dto });
  },

  /** `POST /finance/payments/:id/allocations` — settles the payment against a receivable. */
  allocatePayment(paymentId: string, dto: AllocatePaymentPayload): Promise<unknown> {
    return apiFetch(`/finance/payments/${paymentId}/allocations`, { method: "POST", body: dto });
  },

  /**
   * `GET /finance/receivables` (RAKHAL-340), unfiltered, newest-first (the route's own default
   * `sortOrder`) — used only to find the `Receivable` a just-created milk sale raised. **Real gap
   * found live-verifying this ticket, not assumed from reading source**: `?customerId=` looked
   * like the right filter (`SellMilkUseCase` passes the buyer as `Sale.customerId`, and
   * `ListReceivablesQueryDto` accepts `customerId`) — but `ReceivableService.createReceivable`
   * never actually persists a `customerId` on the `Receivable` row itself (confirmed by reading
   * its `client.receivable.create({ data: {...} })` call — no `customerId` field — and by hitting
   * the live dev backend: `GET /finance/receivables?customerId=<realBuyerId>` returned an empty
   * page for a sale that had just been created for that exact buyer). Every `Receivable.customerId`
   * is `null` today, for every sale type, not just milk — filtering by it can never match.
   * Falls back to what's actually reliable: the just-created receivable is always the newest row
   * for this farm (proven live — a fresh dispatch's `saleId` matched `items[0]` of an unfiltered
   * `limit=5` call), so this fetches the most recent few and matches `saleId` client-side. Flagged
   * in this ticket's IN_FLIGHT writeup as a real backend gap (`Receivable.customerId` dead code)
   * worth a follow-up ticket, not silently worked around.
   */
  listRecentReceivables(): Promise<CursorPage<ReceivableSummary>> {
    return apiFetchPage<ReceivableSummary>("/finance/receivables", { searchParams: { limit: 5 } });
  },

  /**
   * The `Receivable` raised by one sale (`saleId`), for the Invoices row's "Receive payment" and the
   * invoice sheet's payment history. `GET /finance/receivables` has no `saleId` filter (and
   * `Receivable.customerId` is never populated, see `listRecentReceivables`), so this pages the list
   * newest-first, 100 at a time, until the sale's receivable turns up — capped at 5 pages (500
   * receivables), which is far beyond a farm's open balance. A fully-paid-at-sale invoice has no
   * receivable at all and resolves to `null`. A backend `?saleId=` filter would replace this loop.
   */
  async findReceivableBySale(saleId: string): Promise<ReceivableSummary | null> {
    let cursor: string | undefined;
    for (let page = 0; page < 5; page += 1) {
      const result = await apiFetchPage<ReceivableSummary>("/finance/receivables", { searchParams: { limit: 100, cursor } });
      const found = result.items.find((r) => r.saleId === saleId);
      if (found) return found;
      if (!result.meta.hasNextPage) return null;
      cursor = result.meta.endCursor ?? undefined;
    }
    return null;
  },

  /** `POST /sales/inventory` (RAKHAL-346/376). */
  sellInventory(dto: SellInventoryPayload): Promise<SellInventoryResult> {
    return apiFetch<SellInventoryResult>("/sales/inventory", { method: "POST", body: dto });
  },

  /** `POST /sales/manure` (RAKHAL-347/376). */
  sellManure(dto: SellManurePayload): Promise<SellManureResult> {
    return apiFetch<SellManureResult>("/sales/manure", { method: "POST", body: dto });
  },

  /** `GET /sales` v2 (RAKHAL-368) — cursor-paginated, filtered. Backs the Invoices tab. */
  listInvoices(filters: InvoiceListFilters, cursor: string | undefined, limit = 20): Promise<CursorPage<InvoiceRow>> {
    return apiFetchPage<InvoiceRow>("/sales", { searchParams: { ...filters, cursor, limit } });
  },

  /** `GET /sales/summary?from&to&granularity` (RAKHAL-374). Backs the Overview screen. */
  getSummary(from: string, to: string, granularity: SalesTrendGranularity): Promise<SalesSummary> {
    return apiFetch<SalesSummary>("/sales/summary", { searchParams: { from, to, granularity } });
  },

  /** `GET /buyers/dispatches` v2 (RAKHAL-378) — cursor-paginated, `?status=` filter against the
   * derived status. Backs the Dispatches tab (deliberately not `GET /milk/dispatch`, same
   * underlying data but this is the literal route the ticket's PRD ref names). */
  listDispatches(filters: DispatchListFilters, cursor: string | undefined, limit = 20): Promise<CursorPage<DispatchRow>> {
    return apiFetchPage<DispatchRow>("/buyers/dispatches", { searchParams: { ...filters, cursor, limit } });
  },

  /** `GET /buyers/dispatches/summary` (RAKHAL-378). */
  getDispatchesSummary(): Promise<DispatchesSummary> {
    return apiFetch<DispatchesSummary>("/buyers/dispatches/summary");
  },

  /** `PATCH /buyers/dispatches/:id/receipt` (RAKHAL-378) — confirms received volume, PENDING → DELIVERED. */
  recordReceipt(id: string, dto: RecordReceiptPayload): Promise<DispatchRow> {
    return apiFetch<DispatchRow>(`/buyers/dispatches/${id}/receipt`, { method: "PATCH", body: dto });
  },

  /** `POST /buyers/dispatches/:id/cancel` (RAKHAL-377) — `finance.reverse`, cascades into
   * cancelling the dispatch's posted `Sale` if any. */
  cancelDispatch(id: string): Promise<DispatchRow> {
    return apiFetch<DispatchRow>(`/buyers/dispatches/${id}/cancel`, { method: "POST" });
  },

  /** `POST /sales/:id/cancel` (RAKHAL-377/392) — `finance.reverse`, only valid when the sale has
   * no `PaymentAllocation` yet (refuses otherwise — "refund the payment first"). */
  cancelSale(id: string): Promise<unknown> {
    return apiFetch(`/sales/${id}/cancel`, { method: "POST" });
  },
  /** `POST /sales/:id/refund` (RAKHAL-377/392) — the paid-sale counterpart to `cancelSale`. */
  refundSale(id: string): Promise<unknown> {
    return apiFetch(`/sales/${id}/refund`, { method: "POST" });
  },
};
