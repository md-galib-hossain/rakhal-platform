"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorMeta, CursorPage } from "@/types/api";
import type {
  CalfColostrumRecord,
  CalfDetail,
  CalfKpis,
  CalfListFilters,
  CalfListItem,
  CalfMilkFeeding,
  WeanCalfResult,
} from "./types";
import type {
  RecordColostrumInput,
  RecordMilkFeedingInput,
  RecordStarterFeedInput,
  WeanCalfInput,
} from "./schemas";

/** `GET /calves`'s `meta` carries an extra farm-wide `kpis` block alongside the usual cursor
 * fields — same convention as `TaskListPage`/`FinanceListPage` (`apiFetchPage` cast). */
export type CalfListPage = CursorPage<CalfListItem> & { meta: CursorMeta & { kpis: CalfKpis } };

/** `/calves*` — real backend routes (`calf.controller.ts`), `calf.read`/`.log-feeding`/`.update`-gated.
 * No `calf.create` exists: calves originate only from Reproduction's calving-event flow. */
export const calvesApi = {
  list(filters: CalfListFilters, cursor?: string, limit = 20): Promise<CalfListPage> {
    return apiFetchPage<CalfListItem>("/calves", {
      searchParams: { stage: filters.stage, healthStatus: filters.healthStatus, search: filters.search, cursor, limit },
    }) as Promise<CalfListPage>;
  },
  findOne(id: string): Promise<CalfDetail> {
    return apiFetch<CalfDetail>(`/calves/${id}`);
  },
  recordColostrum(id: string, dto: RecordColostrumInput): Promise<CalfColostrumRecord> {
    return apiFetch<CalfColostrumRecord>(`/calves/${id}/colostrum`, { method: "POST", body: dto });
  },
  recordMilkFeeding(id: string, dto: RecordMilkFeedingInput): Promise<CalfMilkFeeding> {
    return apiFetch<CalfMilkFeeding>(`/calves/${id}/milk-feeding`, { method: "POST", body: dto });
  },
  recordStarterFeed(id: string, dto: RecordStarterFeedInput): Promise<{ id: string }> {
    return apiFetch(`/calves/${id}/starter-feed`, { method: "POST", body: dto });
  },
  wean(id: string, dto: WeanCalfInput): Promise<WeanCalfResult> {
    return apiFetch<WeanCalfResult>(`/calves/${id}/wean`, { method: "POST", body: dto });
  },
};
