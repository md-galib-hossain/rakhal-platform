"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  Buyer,
  BuyerListFilters,
  BuyerStatement,
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
  list(filters: BuyerListFilters, cursor?: string, limit = 20): Promise<CursorPage<Buyer>> {
    return apiFetchPage<Buyer>("/buyers", {
      searchParams: { search: filters.search, includeInactive: filters.includeInactive, cursor, limit },
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
  recordDispatch(dto: RecordDispatchPayload): Promise<RecordDispatchResult> {
    return apiFetch<RecordDispatchResult>("/milk/dispatch", { method: "POST", body: dto });
  },
  dispatches(filters: DispatchListFilters, cursor?: string, limit = 20): Promise<CursorPage<Dispatch>> {
    return apiFetchPage<Dispatch>("/milk/dispatch", {
      searchParams: { buyerId: filters.buyerId, from: filters.from, to: filters.to, cursor, limit },
    });
  },
};
