"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { eventsApi } from "@/features/events/api";
import { toEventAt } from "@/features/events/forms/definitions";
import { calvesApi } from "../api";
import type { CalfKpis, CalfListFilters } from "../types";
import type {
  RecordColostrumInput,
  RecordMilkFeedingInput,
  RecordStarterFeedInput,
  RecordWeightInput,
  WeanCalfInput,
} from "../schemas";

const STALE_TIME = 30_000;

const EMPTY_KPIS: CalfKpis = { totalCalves: 0, fedToday: 0, healthConcern: 0, weaningDueThisWeek: 0 };

/** Shared-pager adapter over the cursor-only `GET /calves`. `meta.kpis` is farm-wide (not scoped
 * to the current page/filter), returned by every page fetch — same convention as `useTaskPagedList`. */
export function useCalvesPagedList(filters: CalfListFilters) {
  const pager = useCursorPager(
    qk.calves.list(filters as Record<string, string | undefined>),
    (cursor, limit) => calvesApi.list(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
  return { ...pager, kpis: pager.meta?.kpis ?? EMPTY_KPIS };
}

export function useCalfDetail(id: string | undefined) {
  return useQuery({
    queryKey: qk.calves.detail(id ?? ""),
    queryFn: () => calvesApi.findOne(id!),
    enabled: Boolean(id),
    staleTime: STALE_TIME,
  });
}

function useInvalidateCalf(calfId: string) {
  const queryClient = useQueryClient();
  return () => {
    queryClient.invalidateQueries({ queryKey: ["calves", "list"] });
    queryClient.invalidateQueries({ queryKey: qk.calves.detail(calfId) });
  };
}

export function useRecordColostrum(calfId: string) {
  const invalidate = useInvalidateCalf(calfId);
  return useMutation({
    mutationFn: (dto: RecordColostrumInput) => calvesApi.recordColostrum(calfId, dto),
    onSuccess: invalidate,
  });
}

export function useRecordMilkFeeding(calfId: string) {
  const invalidate = useInvalidateCalf(calfId);
  return useMutation({
    mutationFn: (dto: RecordMilkFeedingInput) => calvesApi.recordMilkFeeding(calfId, dto),
    onSuccess: invalidate,
  });
}

export function useRecordWeight(calfId: string) {
  const invalidate = useInvalidateCalf(calfId);
  return useMutation({
    // A calf is a cattle row: its weight is the one weight event (`POST /cattle/:id/events`, type WEIGHT).
    mutationFn: (dto: RecordWeightInput) =>
      eventsApi.create(
        calfId,
        {
          type: "WEIGHT",
          eventAt: toEventAt(dto.measuredDate, undefined),
          provenance: "RECORDED",
          ...(dto.notes ? { notes: dto.notes } : {}),
          payload: { weightKg: dto.weightKg },
        },
        crypto.randomUUID(),
      ),
    onSuccess: invalidate,
  });
}

export function useRecordStarterFeed(calfId: string) {
  const invalidate = useInvalidateCalf(calfId);
  return useMutation({
    mutationFn: (dto: RecordStarterFeedInput) => calvesApi.recordStarterFeed(calfId, dto),
    onSuccess: invalidate,
  });
}

/** Wean removes the calf from this module entirely (`purpose` flips away from `CALF`) — invalidating
 * the list is enough for the row to disappear on the next fetch; the calling component closes the
 * detail sheet's `?view=` param itself. */
export function useWeanCalf(calfId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: WeanCalfInput) => calvesApi.wean(calfId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calves", "list"] });
      queryClient.invalidateQueries({ queryKey: qk.calves.detail(calfId) });
    },
  });
}
