"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { searchApi } from "../api";

const MIN_QUERY_LENGTH = 2;

/** Backs the ⌘K palette. `enabled` mirrors the backend's own `MIN_QUERY_LENGTH` floor
 * (`search.service.ts`) so a 0–1 character query never fires a request at all — no debounce
 * utility exists anywhere in this codebase (`batch-link-picker.tsx`'s own doc comment), so this
 * doesn't invent one either; react-query's cache/key dedup carries a keystroke-per-request load
 * the same way every other live-search picker here already does. */
export function useGlobalSearch(query: string) {
  const q = query.trim();
  return useQuery({
    queryKey: qk.search.query(q),
    queryFn: () => searchApi.search(q),
    enabled: q.length >= MIN_QUERY_LENGTH,
    staleTime: 30_000,
  });
}
