"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  Buyer,
  BuyerGroupRow,
  BuyerInvoiceRow,
  BuyerListFilters,
  BuyerListRow,
  BuyerOverview,
  BuyerStatement,
  BuyersSummary,
  CreateBuyerPayload,
  Dispatch,
  DispatchListFilters,
  RecordDispatchPayload,
  RecordDispatchResult,
  UpdateBuyerPayload,
} from "./types";

/** `/buyers` + `/milk/dispatch` — real backend routes (`buyer.controller.ts`/
 * `milk-dispatch.controller.ts`), `finance.*`-gated (PRD §11: milk sales are a revenue concern). */
export const buyersApi = {
  /** `GET /buyers` (RAKHAL-372) — now returns `BuyerListRow` (plain fields + 4 server-computed
   * aggregates). `includeArchived` was previously sent as `includeInactive`, a param name the
   * backend never read — fixed alongside `types.ts`'s `Buyer.isActive`→`deletedAt` correction. */
  list(filters: BuyerListFilters, cursor?: string, limit = 20): Promise<CursorPage<BuyerListRow>> {
    return apiFetchPage<BuyerListRow>("/buyers", {
      searchParams: { search: filters.search, includeArchived: filters.includeArchived, cursor, limit },
    });
  },
  get(id: string): Promise<Buyer> {
    return apiFetch<Buyer>(`/buyers/${id}`);
  },
  create(dto: CreateBuyerPayload): Promise<Buyer> {
    return apiFetch<Buyer>("/buyers", { method: "POST", body: dto });
  },
  update(id: string, dto: UpdateBuyerPayload): Promise<Buyer> {
    return apiFetch<Buyer>(`/buyers/${id}`, { method: "PATCH", body: dto });
  },
  deactivate(id: string): Promise<Buyer> {
    return apiFetch<Buyer>(`/buyers/${id}`, { method: "DELETE" });
  },
  statement(id: string, month: string): Promise<BuyerStatement> {
    return apiFetch<BuyerStatement>(`/buyers/${id}/statement`, { searchParams: { month } });
  },
  /** `GET /buyers/summary` (RAKHAL-372) — the AC's 4-stat Buyer Summary. */
  summary(): Promise<BuyersSummary> {
    return apiFetch<BuyersSummary>("/buyers/summary");
  },
  /** `GET /buyers/groups` (RAKHAL-372) — Buyer Groups tab, one row per `BuyerType`. */
  groups(): Promise<BuyerGroupRow[]> {
    return apiFetch<BuyerGroupRow[]>("/buyers/groups");
  },
  /** `GET /buyers/:id/overview` (RAKHAL-372) — buyer detail page header + Overview tab. */
  overview(id: string): Promise<BuyerOverview> {
    return apiFetch<BuyerOverview>(`/buyers/${id}/overview`);
  },
  recordDispatch(dto: RecordDispatchPayload): Promise<RecordDispatchResult> {
    return apiFetch<RecordDispatchResult>("/milk/dispatch", { method: "POST", body: dto });
  },
  dispatches(filters: DispatchListFilters, cursor?: string, limit = 20): Promise<CursorPage<Dispatch>> {
    return apiFetchPage<Dispatch>("/milk/dispatch", {
      searchParams: { buyerId: filters.buyerId, from: filters.from, to: filters.to, cursor, limit },
    });
  },
  /** `GET /sales?customerId=` (RAKHAL-368's v2 `ListSalesQueryDto`) — backs the buyer detail
   * page's "Sales & Invoices" tab. */
  invoices(buyerId: string, cursor?: string, limit = 20): Promise<CursorPage<BuyerInvoiceRow>> {
    return apiFetchPage<BuyerInvoiceRow>("/sales", { searchParams: { customerId: buyerId, cursor, limit } });
  },
};
