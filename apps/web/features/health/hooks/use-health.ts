"use client";

import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { healthApi } from "../api";
import type {
  ApplyHealthPlanPayload,
  ApplyPlanToAnimalsPayload,
  CloseHealthCasePayload,
  BulkCreateHealthCasesPayload,
  CreateHealthCasePayload,
  CreateHealthPlanPayload,
  CreateHealthUpdatePayload,
  HealthListFilters,
  HealthPlanFilters,
  HealthTask,
  HealthTaskFilters,
  RoundFilters,
  LogTaskTreatmentPayload,
  LogTreatmentPayload,
  MortalityPayload,
  RecordTreatmentPayload,
  RescheduleTaskPayload,
  SafetyWithdrawalStatus,
  SkipTaskPayload,
  StopCattleProtocolPayload,
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

/** RFE-133 — the animal's currently-open cases (`GET /health/sick-bay?cattleId=`; the default status filter is
 * the open statuses). Sits under the `["health","sick-bay"]` prefix, so every health mutation refreshes it. */
export function useOpenCasesForCattle(cattleId: string | undefined) {
  return useQuery({
    queryKey: ["health", "sick-bay", "cow", cattleId ?? ""] as const,
    queryFn: () => healthApi.sickBay({ cattleId }, undefined, 10),
    enabled: Boolean(cattleId),
    staleTime: 15_000,
  });
}

/** RFE-138 — farm outcomes over the last `days` days. Under the `["health"]` prefix, and bust by every health
 * mutation (`useInvalidateHealth`), so the card follows case changes. */
export function useHealthOutcomes(days: number) {
  return useQuery({
    queryKey: ["health", "outcomes", days] as const,
    queryFn: () => healthApi.outcomes(days),
    staleTime: STALE_TIME,
  });
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
    void queryClient.invalidateQueries({ queryKey: ["health", "outcomes"] });
    // Completing/logging a treatment also flips its HealthTask's status — bust the Task Hub's
    // list too, not just sick-bay/dashboard (real bug fixed while building the Task Hub tab:
    // previously the Task Hub grid went stale after any case-management action).
    void queryClient.invalidateQueries({ queryKey: qk.health.tasks() });
    // Applied plans panel (Active Plans section in the Health Plan tab) must also refresh when
    // a case is created, deleted, or has a plan applied — those are the three events that change
    // what shows up there.
    void queryClient.invalidateQueries({ queryKey: ["health", "cases", "applied"] });
    void queryClient.invalidateQueries({ queryKey: ["health", "plan-applications"] });
    void queryClient.invalidateQueries({ queryKey: ["health", "plan-runs"] });
    // RFE-142: a protocol card shows live state (animals in progress, steps due / overdue, results), and every one of
    // these actions changes it - applying a protocol, recording / skipping / moving a step, closing a case.
    void queryClient.invalidateQueries({ queryKey: qk.health.plans() });
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

/** RFE-139 — Report Sickness "Several animals". Refreshes the same lists a single report does. */
export function useCreateHealthCasesBulk() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: (dto: BulkCreateHealthCasesPayload) => healthApi.createCasesBulk(dto),
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

/** RD-093 — caseless counterpart of `useLogTreatment`, for a `PlanEnrollment`-only task. */
export function useLogTaskTreatment() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: LogTaskTreatmentPayload }) =>
      healthApi.logTaskTreatment(id, dto),
    onSuccess: () => invalidate(),
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

/** Health steps (`HealthTask`), narrowed by the server (RAKHAL-470): one protocol, steps with no protocol, open statuses,
 * due up to a farm day. Under `qk.health.tasks()`, so every health mutation refreshes it. */
export function useHealthTasks(filters: HealthTaskFilters = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...qk.health.tasks(), filters] as const,
    queryFn: () => healthApi.listTasks(filters),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME,
  });
}

/** RFE-143 — numbered pager over the animals on one protocol (`GET /health/plans/:id/runs`). */
export function useProtocolRunsPagedList(planId: string, filters: { search?: string; status?: "active" | "all" } = {}) {
  return useCursorPager(
    ["health", "plan-runs", planId, "paged", filters],
    (cursor, limit) => healthApi.listPlanRuns(planId, filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
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
export function useSafetyWithdrawals(filters: { status?: SafetyWithdrawalStatus; activeOnly?: boolean; limit?: number } = {}) {
  return useQuery({
    queryKey: [...qk.health.safetyWithdrawals(), filters],
    queryFn: () => healthApi.safetyWithdrawals(filters),
    staleTime: STALE_TIME,
  });
}

/** RFE-141 — the "Withheld" view's numbered pager over the cursor-only `GET /health/safety-withdrawals`. Sits under
 * the `qk.health.safetyWithdrawals()` prefix, so release / refresh keep refreshing it. Unlike `useSafetyWithdrawals`
 * (one capped page, still used for the Sick Bay days-left lookup) this never hides rows past the first page. */
export function useSafetyWithdrawalsPagedList(filters: { status?: SafetyWithdrawalStatus; activeOnly?: boolean } = {}) {
  return useCursorPager(
    [...qk.health.safetyWithdrawals(), "paged", filters],
    (cursor, limit) => healthApi.safetyWithdrawals(filters, cursor, limit),
    { staleTime: STALE_TIME },
  );
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

export function useHealthPlans(filters: HealthPlanFilters = {}) {
  return useQuery({
    queryKey: [...qk.health.plans(), filters],
    queryFn: () => healthApi.listPlans(filters),
    staleTime: STALE_TIME,
    // Keeps the previous list on screen while a new search / condition filter loads, so the Protocols toolbar (and the
    // search box's focus) is not swapped for a skeleton on every keystroke.
    placeholderData: keepPreviousData,
  });
}

/**
 * RFE-142 — the Protocols tab's numbered pager over `GET /health/plans`. Every filter (search, condition, kind, in-use)
 * is applied by the server, so a page is never emptied after the fact and the pager's page count is honest; the cursor
 * trail resets when any filter changes. Under the `qk.health.plans()` prefix, so create / edit / delete (and every health
 * action, see `useInvalidateHealth`) refresh it.
 */
export function useHealthPlansPagedList(filters: HealthPlanFilters = {}) {
  return useCursorPager(
    [...qk.health.plans(), "paged", filters],
    (cursor, limit) => healthApi.listPlans(filters, cursor, limit),
    { staleTime: STALE_TIME, initialPageSize: 10 },
  );
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

/** Protocols v2 — live stock check for the apply dialog's preview step (re-checked on every open). */
export function useProtocolStockCheck(planId: string | undefined, animals: number, enabled = true) {
  return useQuery({
    queryKey: ["health", "plans", "stock-check", planId, animals] as const,
    queryFn: () => healthApi.getPlanStockCheck(planId!, animals),
    enabled: enabled && Boolean(planId) && animals > 0,
    staleTime: 0,
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

/** Every protocol one animal is on (the cow profile's Health tab). `useStopCattleProtocol` busts it; the "skip next
 * step" action in `CattleProtocolsSection` busts it explicitly after `useSkipTask`. */
export function useCattleProtocols(cattleId: string | undefined) {
  return useQuery({
    queryKey: ["health", "cattle-protocols", cattleId ?? ""] as const,
    queryFn: () => healthApi.cattleProtocols(cattleId!),
    enabled: Boolean(cattleId),
    staleTime: 15_000,
  });
}

/** Take one animal off one protocol. Busts everything a protocol touches: the cow's list + health summary, Sick Bay,
 * the Protocols tab (cards + the open sheet's runs), the schedule. */
export function useStopCattleProtocol(cattleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: StopCattleProtocolPayload) => healthApi.stopCattleProtocol(cattleId, dto),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["health"] });
      void queryClient.invalidateQueries({ queryKey: qk.cattle.healthSummary(cattleId) });
    },
  });
}

/** Pages of 100 tasks a protocol's grid reads before it stops and says so (RD-117: the rounds API in RAKHAL-471/472
 * lifts this). 5 × 100 = 500 steps ≈ 40 animals on a 12-step protocol, 160 on a 3-step one. */
const PROTOCOL_GRID_MAX_PAGES = 5;

const protocolTasksKey = (planId: string | undefined) => [...qk.health.tasks(), "protocol-grid", planId ?? ""] as const;

async function fetchProtocolTasks(planId: string | undefined) {
  const filters: HealthTaskFilters = { healthPlanId: planId, sortBy: "due", sortOrder: "asc" };
  const items: HealthTask[] = [];
  let cursor: string | undefined;
  let truncated = false;
  for (let page = 0; page < PROTOCOL_GRID_MAX_PAGES; page += 1) {
    const res = await healthApi.listTasks(filters, cursor, 100);
    items.push(...res.items);
    if (!res.meta.hasNextPage || !res.meta.endCursor) break;
    cursor = res.meta.endCursor;
    truncated = page === PROTOCOL_GRID_MAX_PAGES - 1;
  }
  return { items, truncated };
}

/**
 * RFE-144 — every step (done, skipped, open) of every animal on one protocol, for the sheet's Progress grid. Follows the
 * cursor up to `PROTOCOL_GRID_MAX_PAGES` pages. Under `qk.health.tasks()`, so every health mutation (record, skip,
 * reschedule) refreshes the grid.
 */
export function useProtocolTasks(planId: string | undefined) {
  return useQuery({
    queryKey: protocolTasksKey(planId),
    queryFn: () => fetchProtocolTasks(planId),
    enabled: Boolean(planId),
    staleTime: STALE_TIME,
  });
}

/**
 * RFE-147 — the round grid's cells carry a step's state and dates, not what the record / reschedule / skip dialogs need
 * (medicine, dose, animal, case…). This returns a loader that reads the protocol's full steps (the same cached read as
 * `useProtocolTasks`, up to 500 steps - RD-117) and picks out the ones asked for by id.
 */
export function useProtocolTaskLoader(planId: string) {
  const queryClient = useQueryClient();
  return async (taskIds: string[]): Promise<HealthTask[]> => {
    const { items } = await queryClient.fetchQuery({ queryKey: protocolTasksKey(planId), queryFn: () => fetchProtocolTasks(planId), staleTime: 15_000 });
    const wanted = new Set(taskIds);
    return items.filter((task) => wanted.has(task.id));
  };
}

/** RFE-146 — protocol rounds (`GET /health/rounds`), newest first. One page of up to 100: a farm has tens of rounds, and
 * `hasNextPage` is surfaced so the view can say when it is showing only the first 100. Under `qk.health.tasks()`, so
 * every health mutation refreshes the counts. */
export function useRounds(filters: RoundFilters = {}, options: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...qk.health.tasks(), "rounds", filters] as const,
    queryFn: () => healthApi.listRounds(filters, undefined, 100),
    enabled: options.enabled ?? true,
    staleTime: STALE_TIME,
  });
}

/** RFE-147 — the animal x step grid of one round, paged by animal ("Show more animals"). The header (`round`) and the
 * columns come with every page; the rows are concatenated. */
export function useRoundGrid(roundKey: string | undefined, dueOnly: boolean) {
  return useInfiniteQuery({
    queryKey: [...qk.health.tasks(), "round-grid", roundKey ?? "", dueOnly] as const,
    queryFn: ({ pageParam }) => healthApi.roundGrid(roundKey!, { dueOnly }, pageParam, 50),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => (last.meta.hasNextPage ? (last.meta.endCursor ?? undefined) : undefined),
    enabled: Boolean(roundKey),
    staleTime: STALE_TIME,
  });
}

/** One protocol with its steps and live stats (`GET /health/plans/:id`) — the round sheet's Steps and Results tabs. */
export function useHealthPlan(planId: string | undefined) {
  return useQuery({
    queryKey: [...qk.health.plans(), "detail", planId ?? ""] as const,
    queryFn: () => healthApi.getPlan(planId!),
    enabled: Boolean(planId),
    staleTime: STALE_TIME,
  });
}

/** RFE-148 — add animals to an existing round. A round's counts, grid and the protocol cards all change, so this busts
 * everything `useInvalidateHealth` does (rounds and grids live under `qk.health.tasks()`). */
export function useAddRoundAnimals() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ roundKey, cattleIds }: { roundKey: string; cattleIds: string[] }) => healthApi.addRoundAnimals(roundKey, cattleIds),
    onSuccess: () => invalidate(),
  });
}

/** RFE-148 — take one animal off the protocol a round row belongs to (`POST /cattle/:id/protocols/stop`). Unlike
 * `useStopCattleProtocol` (bound to one animal, for the cow's own page) the animal is chosen per call, because a round
 * lists many. */
export function useRemoveFromRound() {
  const invalidate = useInvalidateHealth();
  return useMutation({
    mutationFn: ({ cattleId, dto }: { cattleId: string; dto: StopCattleProtocolPayload }) => healthApi.stopCattleProtocol(cattleId, dto),
    onSuccess: (_data, { cattleId }) => invalidate(undefined, cattleId),
  });
}
