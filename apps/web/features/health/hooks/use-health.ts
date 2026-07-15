"use client";

import { useState } from "react";
import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { healthApi } from "../api";
import type {
  ApplyHealthPlanPayload,
  CloseHealthCasePayload,
  CreateHealthCasePayload,
  CreateHealthPlanPayload,
  CreateHealthUpdatePayload,
  HealthListFilters,
  HealthPlanCategory,
  HealthPlanType,
  LogTreatmentPayload,
  MortalityPayload,
  RescheduleTaskPayload,
  UpdateHealthPlanPayload,
} from "../types";

const STALE_TIME = 60_000;

export function useHealthDashboard() {
  return useQuery({
    queryKey: qk.health.dashboard(),
    queryFn: healthApi.dashboard,
    staleTime: STALE_TIME,
  });
}

interface PagerState {
  filtersKey: string;
  pageIndex: number;
  cursors: (string | undefined)[];
}

function initialPagerState(filtersKey: string): PagerState {
  return { filtersKey, pageIndex: 0, cursors: [undefined] };
}

/** Numbered-page adapter over the cursor-only `GET /health/sick-bay` — same honest-frontier
 * approach as `useMedicinePagedList`/`useCattlePagedList`: the backend never returns a total/offset,
 * so `totalPages` only ever grows by 1 as the user actually pages past the discovered frontier. */
export function useSickBayPagedList(filters: HealthListFilters) {
  const filtersKey = JSON.stringify(filters);
  const [state, setState] = useState<PagerState>(() => initialPagerState(filtersKey));
  if (state.filtersKey !== filtersKey) {
    setState(initialPagerState(filtersKey));
  }

  const { pageIndex, cursors } = state;
  const cursor = cursors[pageIndex];

  const query = useQuery({
    queryKey: [...qk.health.sickBay(filters as Record<string, string | undefined>), cursor],
    queryFn: () => healthApi.sickBay(filters, cursor),
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

export function useHealthCaseDetail(id: string | undefined) {
  return useQuery({
    queryKey: qk.health.caseDetail(id ?? ""),
    queryFn: () => healthApi.getCase(id!),
    enabled: Boolean(id),
    staleTime: 15_000, // short — the sheet is opened right after a mutation elsewhere
  });
}

function useInvalidateHealth() {
  const queryClient = useQueryClient();
  return (caseId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["health", "sick-bay"] });
    void queryClient.invalidateQueries({ queryKey: qk.health.dashboard() });
    // Completing/logging a treatment also flips its HealthTask's status — bust the Task Hub's
    // list + calendar too, not just sick-bay/dashboard (real bug fixed while building the Task
    // Hub tab: previously the Task Hub grid went stale after any case-management action).
    void queryClient.invalidateQueries({ queryKey: qk.health.tasks() });
    void queryClient.invalidateQueries({ queryKey: ["health", "tasks", "calendar"] });
    if (caseId) void queryClient.invalidateQueries({ queryKey: qk.health.caseDetail(caseId) });
  };
}

export function useCreateHealthCase() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (dto: CreateHealthCasePayload) => healthApi.createCase(dto),
    onSuccess: () => invalidate(),
  });
}

export function useLogTreatment() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: LogTreatmentPayload }) => healthApi.logTreatment(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useHealthUpdate() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CreateHealthUpdatePayload }) => healthApi.healthUpdate(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useCloseHealthCase() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: CloseHealthCasePayload }) => healthApi.closeCase(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useLogMortality() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: MortalityPayload }) => healthApi.logMortality(id, dto),
    onSuccess: (_data, { id }) => invalidate(id),
  });
}

export function useHealthTasks() {
  return useQuery({
    queryKey: qk.health.tasks(),
    queryFn: () => healthApi.listTasks(),
    staleTime: STALE_TIME,
  });
}

export function useHealthTaskCalendar(year: number, month: number) {
  return useQuery({
    queryKey: qk.health.taskCalendar(year, month),
    queryFn: () => healthApi.taskCalendar(year, month),
    staleTime: STALE_TIME,
  });
}

export function useRescheduleTask() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: RescheduleTaskPayload }) => healthApi.rescheduleTask(id, dto),
    onSuccess: () => invalidate(),
  });
}

export function useHealthPlans(filters: { search?: string; category?: HealthPlanCategory; planType?: HealthPlanType } = {}) {
  return useQuery({
    queryKey: [...qk.health.plans(), filters],
    queryFn: () => healthApi.listPlans(filters),
    staleTime: STALE_TIME,
  });
}

function useInvalidatePlans() {
  const queryClient = useQueryClient();
  return () => void queryClient.invalidateQueries({ queryKey: qk.health.plans() });
}

export function useCreatePlan() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: (dto: CreateHealthPlanPayload) => healthApi.createPlan(dto),
    onSuccess: () => invalidate(),
  });
}

export function useUpdatePlan() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateHealthPlanPayload }) => healthApi.updatePlan(id, dto),
    onSuccess: () => invalidate(),
  });
}

/** Applies a plan to one existing health case — see `api.ts#applyPlanToCase` for why there's no
 * bulk variant. `apply-health-plan-dialog.tsx` loops this (and, for animals with no open case yet,
 * `useCreateHealthCase` first) once per selected animal. */
export function useApplyPlanToCase() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ caseId, dto }: { caseId: string; dto: ApplyHealthPlanPayload }) => healthApi.applyPlanToCase(caseId, dto),
    onSuccess: (_data, { caseId }) => invalidate(caseId),
  });
}
