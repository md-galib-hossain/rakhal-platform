"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { milkApi } from "../api";
import type { ReviewAnomalyInput, SaveMilkLogInput, SubmitMilkInput } from "../types";

const STALE_TIME = 60_000;

export function useMilkOverview(date?: string) {
  return useQuery({
    queryKey: qk.milk.overview(date),
    queryFn: () => milkApi.overview(date),
    staleTime: STALE_TIME,
  });
}

export function useMilkLogTable(date?: string, shedId?: string) {
  return useQuery({
    queryKey: qk.milk.log(date, shedId),
    queryFn: () => milkApi.logTable({ date, shedId }),
    staleTime: STALE_TIME,
  });
}

/** Saves a session's draft entries — invalidates the log table + overview (totals/session status change). */
export function useSaveMilkLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveMilkLogInput) => milkApi.saveLog(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.milk.log(variables.date, undefined) });
      queryClient.invalidateQueries({ queryKey: qk.milk.overview(variables.date) });
    },
  });
}

/** Finalizes a session's already-saved draft entries into the tank — same invalidation as save. */
export function useSubmitMilk() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SubmitMilkInput) => milkApi.submit(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.milk.log(variables.date, undefined) });
      queryClient.invalidateQueries({ queryKey: qk.milk.overview(variables.date) });
      queryClient.invalidateQueries({ queryKey: qk.milk.anomalies(variables.date) });
    },
  });
}

export function useMilkAnomalies(date?: string) {
  return useQuery({
    queryKey: qk.milk.anomalies(date),
    queryFn: () => milkApi.anomalies(date),
    staleTime: STALE_TIME,
  });
}

export function useReviewAnomaly() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ReviewAnomalyInput }) => milkApi.reviewAnomaly(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milk", "anomalies"] });
    },
  });
}
