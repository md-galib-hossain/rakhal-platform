"use client";

import { apiFetch } from "@/lib/api/client";
import type { SearchResponse } from "./types";

export const searchApi = {
  /** `GET /search?q=&limit=`. Backend gates below `q.length < 2` (`MIN_QUERY_LENGTH`) by returning
   * an all-empty result rather than 400ing — the frontend mirrors that floor via `enabled` in
   * `useGlobalSearch` so it never fires the request in the first place. */
  search(q: string, limit = 5): Promise<SearchResponse> {
    return apiFetch<SearchResponse>("/search", { searchParams: { q, limit } });
  },
};
