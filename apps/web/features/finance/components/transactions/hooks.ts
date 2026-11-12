"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { transactionsApi } from "./api";
import type { TransactionsFilters } from "./types";

const STALE_TIME = 30_000;
const PAGE_SIZE = 20;

/** RAKHAL-385 (MILESTONE 22) — cursor "load more" Transactions feed, same `useInfiniteQuery`
 * contract `useReproductionCows`/`useMilkQualityTests` already established (`DataTable`'s
 * `hasNextPage`/`isFetchingNextPage`/`onLoadMore` props consume it directly). Re-queries from the
 * first page whenever `filters` changes (the query key is filter-keyed) — matches every other
 * filtered list in this codebase. */
export function useTransactionsList(filters: TransactionsFilters) {
  return useInfiniteQuery({
    queryKey: qk.finance.transactionsListV2(filters as Record<string, string | undefined>),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => transactionsApi.list(filters, pageParam, PAGE_SIZE),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNextPage ? lastPage.meta.endCursor : undefined),
    staleTime: STALE_TIME,
  });
}
