"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { healthApi } from "../api";
import type {
  ApplyHealthPlanPayload,
  ApplyPlanToAnimalsPayload,
  CloseHealthCasePayload,
  CreateHealthCasePayload,
  CreateHealthPlanPayload,
  CreateHealthUpdatePayload,
  HealthListFilters,
  HealthPlanCategory,
  HealthPlanType,
  LogTreatmentPayload,
  MortalityPayload,
  RecordTreatmentPayload,
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
  return (caseId?: string, cattleId?: string) => {
    void queryClient.invalidateQueries({ queryKey: ["health", "sick-bay"] });
    void queryClient.invalidateQueries({ queryKey: qk.health.dashboard() });
    // Completing/logging a treatment also flips its HealthTask's status — bust the Task Hub's
    // list + calendar too, not just sick-bay/dashboard (real bug fixed while building the Task
    // Hub tab: previously the Task Hub grid went stale after any case-management action).
    void queryClient.invalidateQueries({ queryKey: qk.health.tasks() });
    void queryClient.invalidateQueries({ queryKey: ["health", "tasks", "calendar"] });
    // Applied plans panel (Active Plans section in the Health Plan tab) must also refresh when
    // a case is created, deleted, or has a plan applied — those are the three events that change
    // what shows up there.
    void queryClient.invalidateQueries({ queryKey: ["health", "cases", "applied"] });
    if (caseId) void queryClient.invalidateQueries({ queryKey: qk.health.caseDetail(caseId) });
    // A health-case mutation flips the cow's status (e.g. report-sickness -> SICK) on the backend —
    // bust Cattle's own list + this animal's detail/health-summary so the Cattle page isn't stale
    // until a manual refresh (real bug: cattle detail showed the old "healthy" status post-mutation).
    void queryClient.invalidateQueries({ queryKey: ["cattle", "list"] });
    void queryClient.invalidateQueries({ queryKey: qk.cattle.highlights() });
    if (cattleId) {
      void queryClient.invalidateQueries({ queryKey: qk.cattle.detail(cattleId) });
      void queryClient.invalidateQueries({ queryKey: qk.cattle.overview(cattleId) });
      void queryClient.invalidateQueries({ queryKey: qk.cattle.healthSummary(cattleId) });
    }
  };
}

export function useCreateHealthCase() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (dto: CreateHealthCasePayload) => healthApi.createCase(dto),
    onSuccess: (data) => invalidate(undefined, data.cattle?.id),
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
    onSuccess: (data, { id }) => invalidate(id, data.cattle?.id),
  });
}

export function useLogMortality() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: MortalityPayload }) => healthApi.logMortality(id, dto),
    onSuccess: (data, { id }) => invalidate(id, data.cattle?.id),
  });
}

/** RAKHAL-416's Quick Treat route — logs a treatment for N animals in one call, no case id. Bare
 * `invalidate()` (no single id) since this can touch multiple cows at once, same as
 * `useApplyPlanToAnimals`. */
export function useRecordTreatment() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (dto: RecordTreatmentPayload) => healthApi.recordTreatment(dto),
    onSuccess: () => invalidate(),
  });
}

export function useDeleteHealthCase() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (id: string) => healthApi.deleteCase(id),
    onSuccess: (data, id) => invalidate(id, data.cattle?.id),
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

/** RFE-110 (out-of-lane touch, flagged — needed to pass `activeOnly` through to the real query). */
export function useSafetyWithdrawals(filters: { status?: SafetyWithdrawalStatus; activeOnly?: boolean } = {}) {
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

export function useDeletePlan() {
  const invalidate = useInvalidatePlans();
  return useMutation({
    mutationFn: (id: string) => healthApi.deletePlan(id),
    onSuccess: () => invalidate(),
  });
}

/** Applies a plan to one existing health case — used by Sick Bay's "Apply Protocol" row action
 * (RFE-106) and `edit-applied-plan-dialog.tsx`'s reschedule flow. For a fresh multi-animal apply,
 * use `useApplyPlanToAnimals` instead. */
export function useApplyPlanToCase() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ caseId, dto }: { caseId: string; dto: ApplyHealthPlanPayload }) => healthApi.applyPlanToCase(caseId, dto),
    onSuccess: (_data, { caseId }) => invalidate(caseId),
  });
}

/** RAKHAL-414's real bulk-apply route — one call applies a plan to N animals; the backend creates
 * a case only for animals not already on this exact protocol and reports applied/skipped per
 * animal. Replaces the old create-case-then-apply loop in `apply-health-plan-dialog.tsx`. */
export function useApplyPlanToAnimals() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ planId, dto }: { planId: string; dto: ApplyPlanToAnimalsPayload }) => healthApi.applyPlanToAnimals(planId, dto),
    onSuccess: () => invalidate(),
  });
}

/** RFE-107/RAKHAL-415 — Treatments tab's "Preventive Rounds" section. Grouped one row per round
 * (`PlanApplication`), each carrying its own enrolled animals + their progress. Replaces
 * `useAppliedHealthPlans` (removed with the backend route it called). */
export function usePlanApplications(filters: { healthPlanId?: string } = {}) {
  return useQuery({
    queryKey: qk.health.planApplications(filters as Record<string, string | undefined>),
    queryFn: () => healthApi.listPlanApplications(filters),
    staleTime: STALE_TIME,
  });
}
