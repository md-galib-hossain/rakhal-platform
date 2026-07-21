"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { cattleApi } from "../api";
import type { BulkAction, CattleFormPayload, CattleListFilters } from "../types";
import type { CattleArchiveInput, CattleStatusInput } from "../schemas";

const STALE_TIME = 60_000;

interface PagerState {
  filtersKey: string;
  pageIndex: number;
  /** `cursors[i]` = the cursor needed to fetch page `i + 1`; `cursors[0]` is always `undefined`
   * (page 1 needs none). Grows by one entry each time the user pages past the previously-known
   * frontier — the backend is keyset-only (no `total`/offset), so a page number can only ever be
   * "known" once its predecessor has actually been fetched and reported `hasNextPage`. */
  cursors: (string | undefined)[];
}

function initialPagerState(filtersKey: string): PagerState {
  return { filtersKey, pageIndex: 0, cursors: [undefined] };
}

/** Numbered-page adapter over the cursor-only `GET /cattle` endpoint, for the `Pagination` UI.
 * Never fetches by offset — every page is still reached by walking `endCursor`s in order, this
 * just caches the cursor trail so already-visited pages are instant `pageIndex` jumps and the
 * "next" page is a normal cursor fetch. `totalPages` is therefore always a lower bound (what's
 * been discovered so far), not a true count — honest given the backend never returns one. */
export function useCattlePagedList(filters: CattleListFilters) {
  const filtersKey = JSON.stringify(filters);
  const [state, setState] = useState<PagerState>(() => initialPagerState(filtersKey));
  // Reset to page 1 when filters change — a render-time state adjustment (React's documented
  // "adjusting state when a prop changes" pattern), not an effect, so it can't cascade.
  if (state.filtersKey !== filtersKey) {
    setState(initialPagerState(filtersKey));
  }

  const { pageIndex, cursors } = state;
  const cursor = cursors[pageIndex];

  const query = useQuery({
    queryKey: ["cattle", "list", "paged", filters as Record<string, string | undefined>, cursor],
    queryFn: () => cattleApi.list(filters, cursor),
    staleTime: STALE_TIME,
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

  return {
    items: query.data?.items ?? [],
    page: pageIndex + 1,
    totalPages,
    isLoading: query.isLoading,
    isError: query.isError,
    isFetching: query.isFetching,
    refetch: query.refetch,
    goToPage,
  };
}

export function useCattleHighlights() {
  return useQuery({ queryKey: qk.cattle.highlights(), queryFn: cattleApi.highlights, staleTime: STALE_TIME });
}

export function useBreeds() {
  return useQuery({ queryKey: qk.cattle.breeds(), queryFn: cattleApi.breeds, staleTime: STALE_TIME });
}

export function useSheds() {
  return useQuery({ queryKey: qk.cattle.sheds(), queryFn: cattleApi.sheds, staleTime: STALE_TIME });
}

export function useFeedGroups() {
  return useQuery({ queryKey: qk.cattle.feedGroups(), queryFn: cattleApi.feedGroups, staleTime: STALE_TIME });
}

export function useBulkCattle() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      cattleIds,
      action,
      payload,
    }: {
      cattleIds: string[];
      action: BulkAction;
      payload?: { shedId?: string; feedGroupId?: string };
    }) => cattleApi.bulk(cattleIds, action, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["cattle", "list"] });
      void queryClient.invalidateQueries({ queryKey: qk.cattle.highlights() });
    },
  });
}

export function useCattleDetail(id: string | undefined) {
  return useQuery({
    queryKey: qk.cattle.detail(id ?? ""),
    queryFn: () => cattleApi.findOne(id!),
    enabled: Boolean(id),
    staleTime: STALE_TIME,
  });
}

/** Shared invalidation for any mutation that changes a cattle row's list/highlights-visible fields. */
function useInvalidateCattle() {
  const queryClient = useQueryClient();
  return (id?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["cattle", "list"] });
    void queryClient.invalidateQueries({ queryKey: qk.cattle.highlights() });
    if (id) void queryClient.invalidateQueries({ queryKey: qk.cattle.detail(id) });
  };
}

export function useCreateCattle() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: (dto: CattleFormPayload) => cattleApi.create(dto),
    onSuccess: () => invalidate(),
  });
}

export function useUpdateCattle() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CattleFormPayload }) => cattleApi.update(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useUpdateCattleStatus() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CattleStatusInput }) => cattleApi.updateStatus(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useArchiveCattle() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CattleArchiveInput }) => cattleApi.archive(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useRestoreCattle() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: (id: string) => cattleApi.restore(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

export function useSetCattlePhoto() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => cattleApi.setPhoto(id, file),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useRemoveCattlePhoto() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: (id: string) => cattleApi.removePhoto(id),
    onSuccess: (_data, id) => invalidate(id),
  });
}

// RFE-024 — CSV import (multipart preview → confirm). Preview is a plain mutation (no cache entry
// to invalidate, its result is the session itself); confirm invalidates the list on success.
export function useImportCattlePreview() {
  return useMutation({ mutationFn: (file: File) => cattleApi.importPreview(file) });
}

export function useImportCattleConfirm() {
  const invalidate = useInvalidateCattle();
  return useMutation({
    mutationFn: ({ importSessionId, skipErrors }: { importSessionId: string; skipErrors: boolean }) =>
      cattleApi.importConfirm(importSessionId, skipErrors),
    onSuccess: () => invalidate(),
  });
}
