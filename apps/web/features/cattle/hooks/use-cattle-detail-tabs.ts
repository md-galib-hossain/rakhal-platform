"use client";

import { useQuery } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { cattleApi } from "../api";

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
