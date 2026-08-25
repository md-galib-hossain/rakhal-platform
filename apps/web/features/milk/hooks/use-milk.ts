"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { milkApi } from "../api";
import type {
  MilkTrendRange,
  ReviewAnomalyInput,
  SaveMilkLogInput,
  SubmitMilkInput,
  UpdateMilkSessionsInput,
} from "../types";

const STALE_TIME = 60_000;

export function useMilkOverview(date?: string, range?: MilkTrendRange) {
  return useQuery({
    queryKey: qk.milk.overview(date, range),
    queryFn: () => milkApi.overview(date, range),
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
 * change). Both invalidations use their broad `["milk", X]` prefix rather than an exact key:
 * `avgYield7d` is a *trailing* 7-day average (backend excludes the queried day itself, see
 * `avgDailyYield`), so editing e.g. Aug 21's log changes what today's `["milk","log",<today>]`
 * query should show even though today's own date was never touched — an exact-key invalidation
 * on the edited date alone leaves that other cache entry stale until a full reload. Same reasoning
 * covers `MilkKeyMetricsCard`/`MilkTrendChart`'s no-`date` overview query landing on a different
 * cache key from a save/submit for an explicit `date` string even when that string IS today. */
export function useSaveMilkLog() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: SaveMilkLogInput) => milkApi.saveLog(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["milk", "log"] });
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
      queryClient.invalidateQueries({ queryKey: ["milk", "log"] });
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

/** RAKHAL-278 — a cow's current milk eligibility (`GET /milk/cattle/:id/eligibility`). Disabled
 * until a `cattleId` is known, same pattern the detail-tab hooks in other features use. */
export function useMilkEligibility(cattleId: string | undefined) {
  return useQuery({
    queryKey: qk.milk.eligibility(cattleId ?? ""),
    queryFn: () => milkApi.eligibility(cattleId as string),
    enabled: !!cattleId,
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
