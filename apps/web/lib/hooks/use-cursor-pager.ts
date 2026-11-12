"use client";

import { useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";

export const PAGE_SIZE_OPTIONS = [10, 20, 50, 100] as const;
export const DEFAULT_PAGE_SIZE = 20;

interface CursorMeta {
  hasNextPage: boolean;
  endCursor?: string | null;
}

interface PagerState {
  queryKeyJson: string;
  pageSize: number;
  pageIndex: number;
  cursors: (string | undefined)[];
}

function initialPagerState(queryKeyJson: string, pageSize: number): PagerState {
  return { queryKeyJson, pageSize, pageIndex: 0, cursors: [undefined] };
}

/**
 * Numbered-page adapter shared by every cursor-only list endpoint (Cattle, Inventory tabs,
 * Finance, Tasks, Activity, Sick Bay) — previously each module hand-rolled an identical copy of
 * this same state machine. Honest-frontier: the backend never returns a total/offset, so
 * `totalPages` only ever grows by 1 as the user actually pages past the previously-discovered
 * cursor trail. Resets the trail whenever `queryKey` (filters) OR `pageSize` changes — both
 * invalidate every previously-walked cursor.
 */
export function useCursorPager<T, TMeta extends CursorMeta = CursorMeta>(
  queryKey: readonly unknown[],
  fetchPage: (cursor: string | undefined, limit: number) => Promise<{ items: T[]; meta: TMeta }>,
  options?: { staleTime?: number; initialPageSize?: number },
) {
  const queryKeyJson = JSON.stringify(queryKey);
  const [state, setState] = useState<PagerState>(() =>
    initialPagerState(queryKeyJson, options?.initialPageSize ?? DEFAULT_PAGE_SIZE),
  );
  if (state.queryKeyJson !== queryKeyJson) {
    setState(initialPagerState(queryKeyJson, state.pageSize));
  }

  const { pageIndex, cursors, pageSize } = state;
  const cursor = cursors[pageIndex];

  const query = useQuery({
    queryKey: [...queryKey, "pageSize", pageSize, "cursor", cursor],
    queryFn: () => fetchPage(cursor, pageSize),
    staleTime: options?.staleTime ?? 60_000,
    placeholderData: keepPreviousData,
  });

  const atFrontier = pageIndex === cursors.length - 1;
  const hasUndiscoveredNext = atFrontier && Boolean(query.data?.meta.hasNextPage);
  const totalPages = Math.max(cursors.length + (hasUndiscoveredNext ? 1 : 0), 1);

  function goToPage(page: number) {
    const idx = page - 1;
    if (idx < 0 || idx === pageIndex) return;
    if (idx < cursors.length) {
      setState((s) => ({ ...s, pageIndex: idx }));
      return;
    }
    if (idx === cursors.length && hasUndiscoveredNext) {
      const nextCursor = query.data?.meta.endCursor ?? undefined;
      setState((s) => ({ ...s, pageIndex: idx, cursors: [...s.cursors, nextCursor] }));
    }
  }

  function setPageSize(size: number) {
    if (size === pageSize) return;
    setState(initialPagerState(queryKeyJson, size));
  }

  return {
    items: query.data?.items ?? [],
    meta: query.data?.meta,
    page: pageIndex + 1,
    totalPages,
    pageSize,
    setPageSize,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    goToPage,
  };
}
