"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { milkApi } from "../api";
import type {
  ReviewAnomalyInput,
  SaveMilkLogInput,
  SubmitMilkInput,
  UpdateMilkSessionsInput,
} from "../types";

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

/** Saves a session's draft entries — invalidates the log table + overview (totals/session status
 * change). Overview invalidation matches the `["milk", "overview"]` prefix rather than
 * `qk.milk.overview(variables.date)` exactly: `MilkKeyMetricsCard`/`MilkTrendChart` query with no
 * `date` (server defaults to today), a different cache key from a save/submit for an explicit
 * `date` string even when that string IS today — an exact-key invalidation would silently miss them. */
export function useSaveMilkLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveMilkLogInput) => milkApi.saveLog(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.milk.log(variables.date, undefined) });
      queryClient.invalidateQueries({ queryKey: ["milk", "overview"] });
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
      queryClient.invalidateQueries({ queryKey: ["milk", "overview"] });
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

/** Owner-only session toggle — invalidates every `["milk","log"]` entry (all dates/shed filters
 * share the same `sessionConfig`, unlike save/submit which only affect one date). */
export function useUpdateMilkSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateMilkSessionsInput) => milkApi.updateSessions(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milk", "log"] });
    },
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

export function useImportMilkPreview() {
  return useMutation({ mutationFn: (file: File) => milkApi.importPreview(file) });
}

/** Confirm invalidates the same broad set `useSaveMilkLog` does — an import can span many
 * dates, so an exact `qk.milk.log(date)` key can't cover it. */
export function useImportMilkConfirm() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ importSessionId, skipErrors }: { importSessionId: string; skipErrors: boolean }) =>
      milkApi.importConfirm(importSessionId, skipErrors),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milk", "log"] });
      queryClient.invalidateQueries({ queryKey: ["milk", "overview"] });
    },
  });
}
