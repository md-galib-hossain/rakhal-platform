"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
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
  SafetyWithdrawalStatus,
  SkipTaskPayload,
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

/** Shared-pager adapter (`useCursorPager`) over the cursor-only `GET /health/sick-bay`. */
export function useSickBayPagedList(filters: HealthListFilters) {
  return useCursorPager(
    qk.health.sickBay(filters as Record<string, string | undefined>),
    (cursor, limit) => healthApi.sickBay(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
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

/** Plain complete (no treatment log) — for a task with no medicine to record. */
export function useCompleteTask() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (id: string) => healthApi.completeTask(id),
    onSuccess: () => invalidate(),
  });
}

export function useSkipTask() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: SkipTaskPayload }) => healthApi.skipTask(id, dto),
    onSuccess: () => invalidate(),
  });
}

export function useSafetyWithdrawals(filters: { status?: SafetyWithdrawalStatus } = {}) {
  return useQuery({
    queryKey: [...qk.health.safetyWithdrawals(), filters],
    queryFn: () => healthApi.safetyWithdrawals(filters),
    staleTime: STALE_TIME,
  });
}

export function useRefreshSafetyWithdrawals() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => healthApi.refreshSafetyWithdrawals(),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.health.safetyWithdrawals() }),
  });
}

/** RAKHAL-276 — the only path to `RELEASED`, `healthcare.update`-gated. */
export function useReleaseWithdrawal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => healthApi.releaseWithdrawal(id),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: qk.health.safetyWithdrawals() }),
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
