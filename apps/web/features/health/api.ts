"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  ApplyHealthPlanPayload,
  CloseHealthCasePayload,
  CreateHealthCasePayload,
  CreateHealthPlanPayload,
  CreateHealthUpdatePayload,
  HealthCaseDetail,
  HealthCaseListItem,
  HealthDashboard,
  HealthListFilters,
  HealthPlanCategory,
  HealthPlanListItem,
  HealthPlanType,
  HealthTask,
  HealthTaskCalendarDay,
  HealthUpdate,
  LogTreatmentPayload,
  MortalityPayload,
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
  skipTask(id: string, dto: SkipTaskPayload): Promise<HealthTask> {
    return apiFetch<HealthTask>(`/health/tasks/${id}/skip`, { method: "POST", body: dto });
  },
  /** Safety Withdrawals tab (no Figma frame — real backend routes had zero frontend consumer). */
  safetyWithdrawals(
    filters: { status?: SafetyWithdrawalStatus } = {},
    cursor?: string,
  ): Promise<CursorPage<SafetyWithdrawalListItem>> {
    return apiFetchPage<SafetyWithdrawalListItem>("/health/safety-withdrawals", {
      searchParams: { status: filters.status, cursor, limit: 20 },
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
    filters: { search?: string; category?: HealthPlanCategory; planType?: HealthPlanType } = {},
    cursor?: string,
  ): Promise<CursorPage<HealthPlanListItem>> {
    return apiFetchPage<HealthPlanListItem>("/health/plans", {
      searchParams: { search: filters.search, category: filters.category, planType: filters.planType, cursor, limit: 20 },
    });
  },
  createPlan(dto: CreateHealthPlanPayload): Promise<HealthPlanListItem> {
    return apiFetch<HealthPlanListItem>("/health/plans", { method: "POST", body: dto });
  },
  updatePlan(id: string, dto: UpdateHealthPlanPayload): Promise<HealthPlanListItem> {
    return apiFetch<HealthPlanListItem>(`/health/plans/${id}`, { method: "PATCH", body: dto });
  },
  /** No bulk/shed-wide apply endpoint exists — this always targets one existing case, see
   * `apply-health-plan-dialog.tsx` for how a multi-animal "Apply" is orchestrated from this. */
  applyPlanToCase(caseId: string, dto: ApplyHealthPlanPayload): Promise<HealthCaseDetail> {
    return apiFetch<HealthCaseDetail>(`/health/cases/${caseId}/apply-plan`, { method: "POST", body: dto });
  },
};

export interface MedicineOption {
  id: string;
  name: string;
  currentStock: number;
  /** Nested unit-catalog relation (RAKHAL-326) — `GET /inventory/medicines` now returns the full
   * `Unit` row here, not a free-text string. Only `symbol` is used by this picker's preview row. */
  unit: { id: string; name: string; symbol: string };
}

/** Search-select source for the Log Treatment tab's medicine picker — reuses the real
 * `GET /inventory/medicines` route (same one the Inventory module lists from). */
export function searchMedicines(search: string): Promise<CursorPage<MedicineOption>> {
  return apiFetchPage<MedicineOption>("/inventory/medicines", { searchParams: { search: search || undefined, limit: 20 } });
}
