"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { cattleApi } from "../api";
import type { BulkAction, CattleFormPayload, CattleListFilters } from "../types";
import type { CattleArchiveInput, CattleStatusInput } from "../schemas";

const STALE_TIME = 60_000;

/** Numbered-page adapter over the cursor-only `GET /cattle` endpoint, for the `Pagination` UI —
 * thin wrapper around the shared `useCursorPager` (`lib/hooks/use-cursor-pager.ts`). */
export function useCattlePagedList(filters: CattleListFilters) {
  return useCursorPager(
    ["cattle", "list", "paged", filters as Record<string, string | undefined>],
    (cursor, limit) => cattleApi.list(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
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
