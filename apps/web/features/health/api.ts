"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  ApplyHealthPlanPayload,
  ApplyPlanToAnimalsPayload,
  ApplyPlanToAnimalsResult,
  CloseHealthCasePayload,
  BulkCreateHealthCasesPayload,
  BulkCreateHealthCasesResult,
  CreateHealthCasePayload,
  CreateHealthPlanPayload,
  CreateHealthUpdatePayload,
  HealthCaseDetail,
  HealthCaseListItem,
  HealthDashboard,
  HealthListFilters,
  HealthOutcomes,
  HealthPlanCategory,
  HealthPlanListItem,
  HealthPlanType,
  HealthCondition,
  HealthTask,
  HealthTaskCalendarDay,
  HealthUpdate,
  LogTaskTreatmentPayload,
  LogTreatmentPayload,
  MortalityPayload,
  PlanApplicationListItem,
  RecordTreatmentPayload,
  RecordTreatmentResult,
  RescheduleTaskPayload,
  SafetyWithdrawalListItem,
  SafetyWithdrawalStatus,
  SkipTaskPayload,
  TreatmentLog,
  UpdateHealthPlanPayload,
} from "./types";

/** `/health/*` — real backend routes (`health.controller.ts`/`cattle-health.controller.ts`),
 * `healthcare.*`-gated. */
export const healthApi = {
  dashboard(): Promise<HealthDashboard> {
    return apiFetch<HealthDashboard>("/health/dashboard");
  },
  /** RAKHAL-467 — farm results over the curative cases opened in the last `days` days (7–365). */
  outcomes(days: number): Promise<HealthOutcomes> {
    return apiFetch<HealthOutcomes>("/health/outcomes", { searchParams: { days } });
  },
  sickBay(filters: HealthListFilters, cursor?: string, limit = 20): Promise<CursorPage<HealthCaseListItem>> {
    return apiFetchPage<HealthCaseListItem>("/health/sick-bay", {
      searchParams: {
        search: filters.search,
        cattleId: filters.cattleId,
        status: filters.status,
        shed: filters.shed,
        diagnosis: filters.diagnosis,
        priority: filters.priority,
        cursor,
        limit,
      },
    });
  },
  getCase(id: string): Promise<HealthCaseDetail> {
    return apiFetch<HealthCaseDetail>(`/health/cases/${id}`);
  },
  createCase(dto: CreateHealthCasePayload): Promise<HealthCaseDetail> {
    return apiFetch<HealthCaseDetail>("/health/cases", { method: "POST", body: dto });
  },
  /** RAKHAL-469 — one condition for several animals in one transaction; animals with an open case for it are skipped. */
  createCasesBulk(dto: BulkCreateHealthCasesPayload): Promise<BulkCreateHealthCasesResult> {
    return apiFetch<BulkCreateHealthCasesResult>("/health/cases/bulk", { method: "POST", body: dto });
  },
  logTreatment(id: string, dto: LogTreatmentPayload): Promise<{ treatmentLog: TreatmentLog }> {
    return apiFetch<{ treatmentLog: TreatmentLog }>(`/health/cases/${id}/log-treatment`, {
      method: "POST",
      body: dto,
    });
  },
  healthUpdate(id: string, dto: CreateHealthUpdatePayload): Promise<HealthUpdate> {
    return apiFetch<HealthUpdate>(`/health/cases/${id}/health-update`, { method: "POST", body: dto });
  },
  closeCase(id: string, dto: CloseHealthCasePayload): Promise<HealthCaseDetail> {
    return apiFetch<HealthCaseDetail>(`/health/cases/${id}/close`, { method: "POST", body: dto });
  },
  logMortality(id: string, dto: MortalityPayload): Promise<HealthCaseDetail> {
    return apiFetch<HealthCaseDetail>(`/health/cases/${id}/mortality`, { method: "POST", body: dto });
  },
  /** RAKHAL-416 — Quick Treat: logs a treatment for N animals with no case id, one call. */
  recordTreatment(dto: RecordTreatmentPayload): Promise<RecordTreatmentResult> {
    return apiFetch<RecordTreatmentResult>("/health/treatments", { method: "POST", body: dto });
  },
  /** Sick Bay delete — soft delete (`isActive:false`), `healthcare.delete` (manager+). */
  deleteCase(id: string): Promise<HealthCaseDetail> {
    return apiFetch<HealthCaseDetail>(`/health/cases/${id}`, { method: "DELETE" });
  },

  /** Task Hub tab (Figma 734:40931/43007/44187/45177). Generous `limit` — the grid groups every
   * open task into "Scheduled Task Cards" client-side (see `task-grouping.ts`), so a numbered pager
   * over raw per-animal task rows would fight that grouping; a farm's open task count is small. */
  listTasks(cursor?: string): Promise<CursorPage<HealthTask>> {
    return apiFetchPage<HealthTask>("/health/tasks", { searchParams: { cursor, limit: 100 } });
  },
  taskCalendar(year: number, month: number): Promise<HealthTaskCalendarDay[]> {
    return apiFetch<HealthTaskCalendarDay[]>("/health/tasks/calendar", { searchParams: { year, month } });
  },
  rescheduleTask(id: string, dto: RescheduleTaskPayload): Promise<HealthTask> {
    return apiFetch<HealthTask>(`/health/tasks/${id}/reschedule`, { method: "POST", body: dto });
  },
  /** Plain complete — no treatment log, use `logTreatment` instead when a medicine/dose needs
   * recording (that path also marks the task complete). */
  completeTask(id: string): Promise<HealthTask> {
    return apiFetch<HealthTask>(`/health/tasks/${id}/complete`, { method: "POST" });
  },
  /** RD-093 — caseless counterpart of `logTreatment`, for a `PlanEnrollment`-only task
   * (`task.healthCaseId` is null; use `logTreatment` instead when it's set). */
  logTaskTreatment(id: string, dto: LogTaskTreatmentPayload): Promise<{ treatmentLog: TreatmentLog }> {
    return apiFetch<{ treatmentLog: TreatmentLog }>(`/health/tasks/${id}/log-treatment`, {
      method: "POST",
      body: dto,
    });
  },
  skipTask(id: string, dto: SkipTaskPayload): Promise<HealthTask> {
    return apiFetch<HealthTask>(`/health/tasks/${id}/skip`, { method: "POST", body: dto });
  },
  /** RFE-110: no longer a standalone tab, folded into Treatments as a "Withholding" filter
   * section — `activeOnly` backs its default view (RAKHAL-420's `SafetyWithdrawalQueryDto`). */
  safetyWithdrawals(
    filters: { status?: SafetyWithdrawalStatus; activeOnly?: boolean; limit?: number } = {},
    cursor?: string,
  ): Promise<CursorPage<SafetyWithdrawalListItem>> {
    return apiFetchPage<SafetyWithdrawalListItem>("/health/safety-withdrawals", {
      searchParams: { status: filters.status, activeOnly: filters.activeOnly, cursor, limit: filters.limit ?? 20 },
    });
  },
  refreshSafetyWithdrawals(): Promise<{ updated: number }> {
    return apiFetch<{ updated: number }>("/health/safety-withdrawals/refresh", { method: "POST" });
  },
  /** RAKHAL-276: the only path to `RELEASED` — `POST /health/safety-withdrawals/:id/release`,
   * `healthcare.update` (manager+, same as refresh). No body. */
  releaseWithdrawal(id: string): Promise<SafetyWithdrawalListItem> {
    return apiFetch<SafetyWithdrawalListItem>(`/health/safety-withdrawals/${id}/release`, { method: "POST" });
  },
  /** Health Plan tab (Figma 734:45281 + Create/Apply wizards). */
  listPlans(
    filters: { search?: string; category?: HealthPlanCategory; planType?: HealthPlanType; condition?: HealthCondition } = {},
    cursor?: string,
  ): Promise<CursorPage<HealthPlanListItem>> {
    return apiFetchPage<HealthPlanListItem>("/health/plans", {
      searchParams: { search: filters.search, category: filters.category, planType: filters.planType, condition: filters.condition, cursor, limit: 20 },
    });
  },
  createPlan(dto: CreateHealthPlanPayload): Promise<HealthPlanListItem> {
    return apiFetch<HealthPlanListItem>("/health/plans", { method: "POST", body: dto });
  },
  updatePlan(id: string, dto: UpdateHealthPlanPayload): Promise<HealthPlanListItem> {
    return apiFetch<HealthPlanListItem>(`/health/plans/${id}`, { method: "PATCH", body: dto });
  },
  deletePlan(id: string): Promise<HealthPlanListItem> {
    return apiFetch<HealthPlanListItem>(`/health/plans/${id}`, { method: "DELETE" });
  },
  /** Applies to one existing case (Sick Bay's "Apply Protocol" row action). For a fresh multi-animal
   * apply, use `applyPlanToAnimals` instead — it's the real bulk route, not a client-side loop. */
  applyPlanToCase(caseId: string, dto: ApplyHealthPlanPayload): Promise<HealthCaseDetail> {
    return apiFetch<HealthCaseDetail>(`/health/cases/${caseId}/apply-plan`, { method: "POST", body: dto });
  },
  /** RAKHAL-414 — real bulk apply: one call for N animals, backend creates a case only for animals
   * not already on this exact protocol and reports applied/skipped per animal. */
  applyPlanToAnimals(planId: string, dto: ApplyPlanToAnimalsPayload): Promise<ApplyPlanToAnimalsResult> {
    return apiFetch<ApplyPlanToAnimalsResult>(`/health/plans/${planId}/apply`, { method: "POST", body: dto });
  },
  /** RFE-107/RAKHAL-415 — Treatments tab's "Preventive Rounds" section. `GET /health/cases/applied`
   * was removed, not aliased; this reads the real replacement, grouped one row per round rather
   * than one per cow. Search/cattleId/date-range narrowing isn't supported server-side yet (a
   * known, flagged v1 gap on the backend's own side) — only `healthPlanId` filters here. */
  listPlanApplications(
    filters: { healthPlanId?: string } = {},
    cursor?: string,
  ): Promise<CursorPage<PlanApplicationListItem>> {
    return apiFetchPage<PlanApplicationListItem>("/health/plan-applications", {
      searchParams: { healthPlanId: filters.healthPlanId, cursor, limit: 50 },
    });
  },
};

export interface MedicineOption {
  id: string;
  name: string;
  currentStock: number;
  /** Nested unit-catalog relation (RAKHAL-326) — `GET /inventory/medicines` now returns the full
   * `Unit` row here, not a free-text string. Only `symbol` is used by this picker's preview row. */
  unit: { id: string; name: string; symbol: string };
  /** Real fields on the wire (`medicine.service.ts` returns the full model, no `select`) — used by
   * `quick-treat-dialog.tsx` to preview the withdrawal-hold date and whether a payment account is
   * required, mirroring the backend's own `resolvedCost`/`createSafetyWithdrawalIfNeeded` math. */
  costPerUnit: number | null;
  milkWithdrawalDays: number | null;
  meatWithdrawalDays: number | null;
}

/** Search-select source for the Log Treatment tab's medicine picker — reuses the real
 * `GET /inventory/medicines` route (same one the Inventory module lists from). */
export function searchMedicines(search: string): Promise<CursorPage<MedicineOption>> {
  return apiFetchPage<MedicineOption>("/inventory/medicines", { searchParams: { search: search || undefined, limit: 20 } });
}
