"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  ApplyProtocolResult,
  CreateProtocolPayload,
  LactationCompareResponse,
  LactationComparisonGroupBy,
  LactationCurveResponse,
  LactationGroupBucketResult,
  LactationRow,
  LactationStatsResponse,
  PregnancyRow,
  PregnancyStatus,
  ProtocolDetail,
  ProtocolInstance,
  ProtocolInstanceListFilters,
  ProtocolKpis,
  ProtocolSummary,
  ReproDashboardResponse,
  ReproductionCowRow,
  ReproductiveStatus,
  UpdateProtocolPayload,
} from "./types";
import type {
  ApplyProtocolInput,
  RecordProtocolAiInput,
  RecordProtocolOutcomeInput,
  CloseProtocolInstanceInput,
} from "./schemas";

/** `/reproduction*` — real backend routes (`reproduction.controller.ts`, `repro-protocol.controller.ts`),
 * `reproduction.read`/`.create`/`.heat`/`.update`-gated. RAKHAL-051 dashboard returns a bespoke
 * shape (not a cursor page). Every write to heat/AI/pregnancy/calving/abortion/dry-off goes through
 * `POST /cattle/:id/events` (`features/events/api.ts`), so none is wrapped here. */
export const reproductionApi = {
  dashboard(): Promise<ReproDashboardResponse> {
    return apiFetch<ReproDashboardResponse>("/reproduction/dashboard");
  },
  /** RAKHAL-363: every cow currently OPEN / BRED_AWAITING_CONFIRMATION / PREGNANT, real cursor page —
   * replaces the old dashboard-embedded, uncapped, OPEN-only `open_cows[]` list. */
  reproductionCows(
    status?: ReproductiveStatus,
    cursor?: string,
    limit = 20,
  ): Promise<CursorPage<ReproductionCowRow>> {
    return apiFetchPage<ReproductionCowRow>("/reproduction/cows", { searchParams: { status, cursor, limit } });
  },

  pregnancies(
    cattleId?: string,
    cursor?: string,
    limit = 20,
    status?: PregnancyStatus,
  ): Promise<CursorPage<PregnancyRow>> {
    return apiFetchPage<PregnancyRow>("/reproduction/pregnancies", { searchParams: { cattleId, cursor, limit, status } });
  },
  lactations(cattleId?: string, cursor?: string, limit = 20): Promise<CursorPage<LactationRow>> {
    return apiFetchPage<LactationRow>("/reproduction/lactations", { searchParams: { cattleId, cursor, limit } });
  },
  /** RAKHAL-291-F/283/284 — today/7d/30d yield, lactation-to-date totals by disposition, peak,
   * persistency for the cow profile's Lactation Summary card. */
  lactationStats(lactationId: string): Promise<LactationStatsResponse> {
    return apiFetch<LactationStatsResponse>(`/reproduction/lactations/${lactationId}/stats`);
  },

  /** RAKHAL-292-F. Daily-yield-by-DIM series with data-quality markers (RAKHAL-283); optional
   * `compareLactationId` requests a second DIM-aligned series for overlay charting. */
  lactationCurve(lactationId: string, compareLactationId?: string): Promise<LactationCurveResponse> {
    return apiFetch<LactationCurveResponse>(`/reproduction/lactations/${lactationId}/curve`, {
      searchParams: { compareLactationId },
    });
  },
  /** RAKHAL-287 — current vs. previous lactation for one cow, DIM-aligned. */
  compareLactations(cattleId: string, byLactationNumber = true): Promise<LactationCompareResponse> {
    return apiFetch<LactationCompareResponse>("/reproduction/lactations/compare", {
      searchParams: { cattleId, byLactationNumber },
    });
  },
  /** RAKHAL-287 — farm-level average yield/peak/persistency, bucketed by `groupBy`. */
  compareLactationGroups(groupBy: LactationComparisonGroupBy): Promise<LactationGroupBucketResult[]> {
    return apiFetch<LactationGroupBucketResult[]>("/reproduction/lactations/compare/groups", {
      searchParams: { groupBy },
    });
  },

  /** RAKHAL-285/297-F — farmer-set target dry-off date, a plan only (doesn't end the lactation). `plannedDryOffAt: null` clears it back to unset. */
  updatePlannedDryOff(lactationId: string, plannedDryOffAt: string | null): Promise<LactationRow> {
    return apiFetch<LactationRow>(`/reproduction/lactations/${lactationId}/planned-dry-off`, {
      method: "PATCH",
      body: { plannedDryOffAt },
    });
  },

  // Protocols (RAKHAL-214) — `reproduction/protocols*`.
  /** Cursor-paginated (RAKHAL-407 follow-up) — system defaults first, then this farm's own. */
  protocols(cursor?: string, limit = 20): Promise<CursorPage<ProtocolSummary>> {
    return apiFetchPage<ProtocolSummary>("/reproduction/protocols", { searchParams: { cursor, limit } });
  },
  protocolKpis(): Promise<ProtocolKpis> {
    return apiFetch<ProtocolKpis>("/reproduction/protocols/kpis");
  },
  protocol(id: string): Promise<ProtocolDetail> {
    return apiFetch<ProtocolDetail>(`/reproduction/protocols/${id}`);
  },
  protocolInstances(
    filters: ProtocolInstanceListFilters,
    cursor?: string,
    limit = 20,
  ): Promise<CursorPage<ProtocolInstance>> {
    return apiFetchPage<ProtocolInstance>("/reproduction/protocols/instances", {
      searchParams: { ...filters, cursor, limit },
    });
  },
  /** `GET /reproduction/protocols/instances/:id` — used to auto-open the timeline sheet right
   * after "Apply Protocol" succeeds (user request, no ticket #). */
  protocolInstance(id: string): Promise<ProtocolInstance> {
    return apiFetch<ProtocolInstance>(`/reproduction/protocols/instances/${id}`);
  },
  applyProtocol(input: ApplyProtocolInput): Promise<ApplyProtocolResult> {
    return apiFetch<ApplyProtocolResult>("/reproduction/protocols/apply", { method: "POST", body: input });
  },
  recordProtocolAi(instanceId: string, input: RecordProtocolAiInput): Promise<ProtocolInstance> {
    return apiFetch<ProtocolInstance>(`/reproduction/protocols/instances/${instanceId}/ai`, {
      method: "POST",
      body: input,
    });
  },
  recordProtocolOutcome(instanceId: string, input: RecordProtocolOutcomeInput): Promise<ProtocolInstance> {
    return apiFetch<ProtocolInstance>(`/reproduction/protocols/instances/${instanceId}/outcome`, {
      method: "POST",
      body: input,
    });
  },
  closeProtocolInstance(instanceId: string, input: CloseProtocolInstanceInput): Promise<ProtocolInstance> {
    return apiFetch<ProtocolInstance>(`/reproduction/protocols/instances/${instanceId}/close`, {
      method: "POST",
      body: input,
    });
  },
  /** `POST /reproduction/protocols` (RAKHAL-407, `reproduction.create`-gated) — a farm-owned
   * protocol only, a system default is never created this way. */
  createProtocol(input: CreateProtocolPayload): Promise<ProtocolDetail> {
    return apiFetch<ProtocolDetail>("/reproduction/protocols", { method: "POST", body: input });
  },
  /** `PATCH /reproduction/protocols/:id` — 404s on a system default (never editable). */
  updateProtocol(id: string, input: UpdateProtocolPayload): Promise<ProtocolDetail> {
    return apiFetch<ProtocolDetail>(`/reproduction/protocols/${id}`, { method: "PATCH", body: input });
  },
  /** `DELETE /reproduction/protocols/:id` — 409s while a cow is actively on it. */
  deleteProtocol(id: string): Promise<{ deleted: boolean }> {
    return apiFetch(`/reproduction/protocols/${id}`, { method: "DELETE" });
  },
};
