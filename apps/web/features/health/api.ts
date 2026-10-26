"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorMeta, CursorPage } from "@/types/api";
import type {
  ApplyHealthPlanPayload,
  ApplyPlanToAnimalsPayload,
  ApplyPlanToAnimalsResult,
  AddRoundAnimalsResult,
  CattleProtocolRun,
  ProtocolRound,
  RoundFilters,
  RoundGridData,
  CloseHealthCasePayload,
  BulkCreateHealthCasesPayload,
  BulkCreateHealthCasesResult,
  CreateHealthCasePayload,
  StopCattleProtocolPayload,
  CreateHealthPlanPayload,
  CreateHealthUpdatePayload,
  HealthCaseDetail,
  HealthCaseListItem,
  HealthDashboard,
  HealthListFilters,
  HealthOutcomes,
  HealthPlanFilters,
  HealthPlanListItem,
  HealthTask,
  HealthUpdate,
  MorbidityTrend,
  LogTaskTreatmentPayload,
  LogTreatmentPayload,
  MortalityPayload,
  PlanRun,
  HealthTaskFilters,
  RecordTreatmentPayload,
  RecordTreatmentResult,
  RescheduleTaskPayload,
  SafetyWithdrawalListItem,
  SafetyWithdrawalStatus,
  SkipTaskPayload,
  TreatmentLog,
  TreatmentLogFilters,
  TreatmentLogListItem,
  UpdateHealthPlanPayload,
} from "./types";
import type { ProtocolStockCheck, UndoResult } from "./types";

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
  /** Sickness trend for the Insights chart over the last `days` days; omit for all time. */
  morbidityTrend(days?: number): Promise<MorbidityTrend> {
    return apiFetch<MorbidityTrend>("/health/morbidity-trend", { searchParams: { days } });
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
  /** Farm-wide treatment logs history (curative and preventive). */
  treatmentLogs(filters: TreatmentLogFilters = {}, cursor?: string, limit = 20): Promise<CursorPage<TreatmentLogListItem>> {
    return apiFetchPage<TreatmentLogListItem>("/health/treatments", {
      searchParams: {
        search: filters.search,
        careType: filters.careType,
        cattleId: filters.cattleId,
        cursor,
        limit,
      },
    });
  },
  /** Sick Bay delete — soft delete (`isActive:false`), `healthcare.delete` (manager+). */
  deleteCase(id: string): Promise<HealthCaseDetail> {
    return apiFetch<HealthCaseDetail>(`/health/cases/${id}`, { method: "DELETE" });
  },

  /** Task Hub tab (Figma 734:40931/43007/44187/45177). Generous `limit` — the grid groups every
   * open task into "Scheduled Task Cards" client-side (see `task-grouping.ts`), so a numbered pager
   * over raw per-animal task rows would fight that grouping; a farm's open task count is small. */
  listTasks(filters: HealthTaskFilters = {}, cursor?: string, limit = 100): Promise<CursorPage<HealthTask>> {
    return apiFetchPage<HealthTask>("/health/tasks", {
      searchParams: {
        healthPlanId: filters.healthPlanId,
        noPlan: filters.noPlan,
        statuses: filters.statuses?.join(","),
        dueTo: filters.dueTo,
        sortBy: filters.sortBy,
        sortOrder: filters.sortOrder,
        cursor,
        limit,
      },
    });
  },
  /** RAKHAL-471 — protocol rounds (one application of a protocol on one farm day), newest first. */
  listRounds(filters: RoundFilters = {}, cursor?: string, limit = 100): Promise<CursorPage<ProtocolRound>> {
    return apiFetchPage<ProtocolRound>("/health/rounds", {
      searchParams: { status: filters.status, kind: filters.kind, search: filters.search, healthPlanId: filters.healthPlanId, cursor, limit },
    });
  },
  /** RAKHAL-472 — the animal x step grid of one round. The envelope's `data` is an object (round + columns + rows) and
   * `meta` pages the rows (animals); `apiFetchPage` is typed for list `data`, so it is narrowed here. */
  async roundGrid(roundKey: string, opts: { dueOnly?: boolean } = {}, cursor?: string, limit = 50): Promise<{ data: RoundGridData; meta: CursorMeta }> {
    const page = await apiFetchPage<unknown>(`/health/rounds/${encodeURIComponent(roundKey)}/grid`, {
      searchParams: { dueOnly: opts.dueOnly ? true : undefined, cursor, limit },
    });
    return { data: page.items as unknown as RoundGridData, meta: page.meta };
  },
  /** RAKHAL-473 — add animals to a round that already exists (up to 100). Animals already on the protocol are skipped. */
  addRoundAnimals(roundKey: string, cattleIds: string[]): Promise<AddRoundAnimalsResult> {
    return apiFetch<AddRoundAnimalsResult>(`/health/rounds/${encodeURIComponent(roundKey)}/animals`, { method: "POST", body: { cattleIds } });
  },
  /** One protocol with its steps and live stats — an archived protocol too (a round of it can still be running). */
  getPlan(id: string): Promise<HealthPlanListItem> {
    return apiFetch<HealthPlanListItem>(`/health/plans/${id}`);
  },
  /** RFE-143 — the animals on one protocol (`GET /health/plans/:id/runs`): open runs by default, `all` adds finished ones. */
  listPlanRuns(planId: string, filters: { search?: string; status?: "active" | "all" } = {}, cursor?: string, limit = 20): Promise<CursorPage<PlanRun>> {
    return apiFetchPage<PlanRun>(`/health/plans/${planId}/runs`, {
      searchParams: { search: filters.search, status: filters.status, cursor, limit },
    });
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
  /** Every protocol one animal is on now (treatment on a case + preventive / breeding rounds), soonest next step first. */
  cattleProtocols(cattleId: string): Promise<{ items: CattleProtocolRun[] }> {
    return apiFetch<{ items: CattleProtocolRun[] }>(`/cattle/${cattleId}/protocols`);
  },
  /** Take one animal off one protocol; its open steps are skipped (kept in history). */
  stopCattleProtocol(cattleId: string, dto: StopCattleProtocolPayload): Promise<{ healthCaseId: string | null; planEnrollmentId: string | null }> {
    return apiFetch(`/cattle/${cattleId}/protocols/stop`, { method: "POST", body: dto });
  },
  /** Undo, one animal, one call: every recorded dose is reversed (stock back, expense reversed, withdrawal cancelled), every
   * step deleted, and a sickness case the apply created is removed. Unlike `stopCattleProtocol` nothing is kept. */
  cancelCattleProtocol(cattleId: string, dto: StopCattleProtocolPayload): Promise<UndoResult> {
    return apiFetch<UndoResult>(`/cattle/${cattleId}/protocols/cancel`, { method: "POST", body: dto });
  },
  /** Undo a whole application (every animal of the round) in one call. */
  cancelRound(roundKey: string, reason?: string): Promise<UndoResult & { roundKey: string; animals: number; casesRemoved: number }> {
    return apiFetch(`/health/rounds/${encodeURIComponent(roundKey)}/cancel`, { method: "POST", body: { reason } });
  },
  /** Void one recorded dose: stock back to its batches, expense reversed, step back to pending. */
  voidTreatment(id: string, reason?: string): Promise<{ id: string; voided: boolean }> {
    return apiFetch(`/health/treatments/${id}/void`, { method: "POST", body: { reason } });
  },
  /** RFE-110: no longer a standalone tab, folded into Treatments as a "Withholding" filter
   * section — `activeOnly` backs its default view (RAKHAL-420's `SafetyWithdrawalQueryDto`). */
  safetyWithdrawals(
    filters: { status?: SafetyWithdrawalStatus; activeOnly?: boolean; limit?: number } = {},
    cursor?: string,
    limit?: number,
  ): Promise<CursorPage<SafetyWithdrawalListItem>> {
    return apiFetchPage<SafetyWithdrawalListItem>("/health/safety-withdrawals", {
      searchParams: { status: filters.status, activeOnly: filters.activeOnly, cursor, limit: limit ?? filters.limit ?? 20 },
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
  listPlans(filters: HealthPlanFilters = {}, cursor?: string, limit = 20): Promise<CursorPage<HealthPlanListItem>> {
    return apiFetchPage<HealthPlanListItem>("/health/plans", {
      searchParams: {
        search: filters.search,
        category: filters.category,
        planType: filters.planType,
        condition: filters.condition,
        kind: filters.kind,
        inUse: filters.inUse,
        cursor,
        limit,
      },
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
  /** Protocols v2 — would applying this protocol to `animals` animals run short of usable (non-expired) stock? */
  getPlanStockCheck(planId: string, animals: number): Promise<ProtocolStockCheck> {
    return apiFetch<ProtocolStockCheck>(`/health/plans/${planId}/stock-check`, { searchParams: { animals } });
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
