"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
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

export function useCattleCalvingEvents(id: string, enabled: boolean) {
  return useQuery({
    queryKey: qk.cattle.calvingEvents(id),
    queryFn: () => cattleApi.calvingEvents(id),
    staleTime: STALE_TIME,
    enabled,
  });
}

/** `cattle.bcs` (worker-permitted, PRD §26) — invalidates the Overview tab's `bcs_records`. */
export function useRecordBcs(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordBcsInput) => cattleApi.recordBcs(id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.cattle.overview(id) });
      void queryClient.invalidateQueries({ queryKey: qk.cattle.detail(id) });
    },
  });
}

/** `cattle.update` (manager+, no worker perm yet — TECH_DEBT RD-012(f)). */
export function useRecordWeight(id: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: RecordWeightInput) => cattleApi.recordWeight(id, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: qk.cattle.overview(id) });
      void queryClient.invalidateQueries({ queryKey: qk.cattle.detail(id) });
      void queryClient.invalidateQueries({ queryKey: ["cattle", "weight-history", id] });
    },
  });
}
