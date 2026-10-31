"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { todayLocalIso } from "@/lib/local-date";
import { eventsApi } from "@/features/events/api";
import { toEventAt } from "@/features/events/forms/definitions";
import { cattleApi } from "../api";
import type { WeightHistoryPeriod } from "../detail-types";
import type { RecordBcsInput, RecordWeightInput } from "../schemas";

const STALE_TIME = 60_000;

export function useCattleOverview(id: string) {
  return useQuery({ queryKey: qk.cattle.overview(id), queryFn: () => cattleApi.overview(id), staleTime: STALE_TIME });
}

export function useCattlePedigree(id: string) {
  return useQuery({ queryKey: qk.cattle.pedigree(id), queryFn: () => cattleApi.pedigree(id), staleTime: STALE_TIME });
}

export function useCattleFinance(id: string, period?: string) {
  return useQuery({
    queryKey: qk.cattle.finance(id, period),
    queryFn: () => cattleApi.finance(id, period),
    staleTime: STALE_TIME,
  });
}

export function useWeightHistory(id: string, period: WeightHistoryPeriod) {
  return useQuery({
    queryKey: qk.cattle.weightHistory(id, period),
    queryFn: () => cattleApi.weightHistory(id, period),
    staleTime: STALE_TIME,
  });
}

/** Female cattle only (`getFemaleCattle` 400s otherwise) — pass `enabled: false` for non-female cattle
 * rather than letting the query fire and error. */
export function useCattleReproductionSummary(id: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.cattle.reproductionSummary(id),
    queryFn: () => cattleApi.reproductionSummary(id),
    staleTime: STALE_TIME,
    enabled,
  });
}

export function useCattleHealthSummary(id: string) {
  return useQuery({
    queryKey: qk.cattle.healthSummary(id),
    queryFn: () => cattleApi.healthSummary(id),
    staleTime: STALE_TIME,
  });
}

/** `POST /cattle/:id/events` type BCS. `cattle.bcs` (worker-permitted, PRD §26) — invalidates the Overview tab's `bcs_records`. */
export function useRecordBcs(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordBcsInput) =>
      eventsApi.create(
        id,
        {
          type: "BCS",
          eventAt: toEventAt(dto.date || todayLocalIso(), undefined),
          provenance: "RECORDED",
          ...(dto.notes ? { notes: dto.notes } : {}),
          payload: { score: dto.score },
        },
        crypto.randomUUID(),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.cattle.overview(id) });
      void queryClient.invalidateQueries({ queryKey: qk.cattle.detail(id) });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}

/** `POST /cattle/:id/events` type WEIGHT. `cattle.update` (manager+, no worker perm yet — TECH_DEBT RD-012(f)). */
export function useRecordWeight(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordWeightInput) =>
      eventsApi.create(
        id,
        {
          type: "WEIGHT",
          eventAt: dto.date || new Date().toISOString(),
          provenance: "RECORDED",
          ...(dto.notes ? { notes: dto.notes } : {}),
          payload: { weightKg: dto.weightKg },
        },
        crypto.randomUUID(),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.cattle.overview(id) });
      void queryClient.invalidateQueries({ queryKey: qk.cattle.detail(id) });
      void queryClient.invalidateQueries({ queryKey: ["cattle", "weight-history", id] });
      void queryClient.invalidateQueries({ queryKey: ["events"] });
    },
  });
}
