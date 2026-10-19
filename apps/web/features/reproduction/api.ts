"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  AbortionEventRow,
  ApplyProtocolResult,
  BreedingEventRow,
  CalvingEventRow,
  CreateCalvingEventResult,
  CreateProtocolPayload,
  DryPeriodRow,
  HeatEventRow,
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
  ReproEventEntry,
  ReproEventsQuery,
  ReproductionCowRow,
  ReproductiveStatus,
  UpdateProtocolPayload,
} from "./types";
import type {
  ApplyProtocolInput,
  CreateAbortionEventInput,
  CreateBreedingEventInput,
  CreateCalvingEventInput,
  CreateDryOffInput,
  CreateHeatEventInput,
  CreatePregnancyDiagnosisInput,
  EditBreedingEventInput,
  EditHeatEventInput,
  EditPregnancyDiagnosisInput,
  ResolveHeatEventInput,
  VoidBreedingEventInput,
  RecordProtocolAiInput,
  RecordProtocolOutcomeInput,
  CloseProtocolInstanceInput,
  ReturnToHeatInput,
} from "./schemas";

/** `/reproduction*` — real backend routes (`reproduction.controller.ts`, `repro-protocol.controller.ts`),
 * `reproduction.read`/`.create`/`.heat`/`.update`-gated. RAKHAL-051 dashboard/events return bespoke
 * shapes (not cursor pages); the six sub-resource lists and protocol instances are real cursor pages. */
export const reproductionApi = {
  dashboard(): Promise<ReproDashboardResponse> {
    return apiFetch<ReproDashboardResponse>("/reproduction/dashboard");
  },
  /** Real keyset cursor page (backend 2026-09-30): pass `meta.endCursor` back as `cursor`. The merged
   * five-table stream is ordered by `(event_date, event_type, id)`; `sortOrder` flips it. Before that
   * date the route ignored `cursor` and returned only the newest `limit` rows. */
  events(query: ReproEventsQuery): Promise<CursorPage<ReproEventEntry>> {
    return apiFetchPage<ReproEventEntry>("/reproduction/events", {
      searchParams: {
        cattleId: query.cattleId,
        eventType: query.eventType,
        fromDate: query.fromDate,
        toDate: query.toDate,
        limit: query.limit,
        cursor: query.cursor,
        sortOrder: query.sortOrder,
      },
    });
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

  heatEvents(cattleId?: string, cursor?: string, limit = 20): Promise<CursorPage<HeatEventRow>> {
    return apiFetchPage<HeatEventRow>("/reproduction/heat-events", { searchParams: { cattleId, cursor, limit } });
  },
  createHeatEvent(input: CreateHeatEventInput): Promise<HeatEventRow> {
    return apiFetch<HeatEventRow>("/reproduction/heat-events", { method: "POST", body: input });
  },
  /** RAKHAL-305 — `ReproductionEditController.editHeatEvent` (`reproduction.update`, manager+). Only the
   * fields sent change, so a wrong-cow fix is `{ cattleId }`. */
  editHeatEvent(id: string, input: EditHeatEventInput): Promise<HeatEventRow> {
    return apiFetch<HeatEventRow>(`/reproduction/heat-events/${id}`, { method: "PATCH", body: input });
  },
  /** Removes a heat recorded by mistake (`reproduction.update`, manager+); the backend refuses once a breeding is linked to it. */
  cancelHeatEvent(id: string, input: { reason?: string } = {}): Promise<{ id: string; cancelled: boolean }> {
    return apiFetch<{ id: string; cancelled: boolean }>(`/reproduction/heat-events/${id}/cancel`, {
      method: "POST",
      body: input,
    });
  },
  /** RAKHAL-298 — closes an open heat as `FALSE_ALARM` / `SKIPPED_CYCLE` (`reproduction.heat`). */
  resolveHeatEvent(id: string, input: ResolveHeatEventInput): Promise<HeatEventRow> {
    return apiFetch<HeatEventRow>(`/reproduction/heat-events/${id}/resolve`, { method: "POST", body: input });
  },

  breedingEvents(cattleId?: string, cursor?: string, limit = 20): Promise<CursorPage<BreedingEventRow>> {
    return apiFetchPage<BreedingEventRow>("/reproduction/breeding-events", {
      searchParams: { cattleId, cursor, limit },
    });
  },
  createBreedingEvent(input: CreateBreedingEventInput): Promise<BreedingEventRow> {
    return apiFetch<BreedingEventRow>("/reproduction/breeding-events", { method: "POST", body: input });
  },
  breedingEvent(id: string): Promise<BreedingEventRow> {
    return apiFetch<BreedingEventRow>(`/reproduction/breeding-events/${id}`);
  },
  /** RAKHAL-305 — `ReproductionEditController.editBreedingEvent`. */
  editBreedingEvent(id: string, input: EditBreedingEventInput): Promise<BreedingEventRow> {
    return apiFetch<BreedingEventRow>(`/reproduction/breeding-events/${id}`, { method: "PATCH", body: input });
  },
  /** Void a breeding / AI recorded by mistake (`reproduction.update`): reverses its cost, restores the straw,
   * reopens the heat it closed, cancels the pregnancy-check task. 400 once it has a pregnancy check. */
  voidBreedingEvent(id: string, input: VoidBreedingEventInput): Promise<BreedingEventRow> {
    return apiFetch<BreedingEventRow>(`/reproduction/breeding-events/${id}/void`, { method: "POST", body: input });
  },
  /** RAKHAL-316: farmer-confirmed return to heat before a pregnancy check was due — creates a real
   * `HeatEvent`, never a fake `PregnancyDiagnosis`. */
  returnToHeat(breedingEventId: string, input: ReturnToHeatInput): Promise<HeatEventRow> {
    return apiFetch<HeatEventRow>(`/reproduction/breeding-events/${breedingEventId}/return-to-heat`, {
      method: "POST",
      body: input,
    });
  },

  pregnancies(
    cattleId?: string,
    cursor?: string,
    limit = 20,
    status?: PregnancyStatus,
  ): Promise<CursorPage<PregnancyRow>> {
    return apiFetchPage<PregnancyRow>("/reproduction/pregnancies", { searchParams: { cattleId, cursor, limit, status } });
  },
  createPregnancyDiagnosis(input: CreatePregnancyDiagnosisInput): Promise<PregnancyRow> {
    return apiFetch<PregnancyRow>("/reproduction/pregnancy-diagnoses", { method: "POST", body: input });
  },
  /** RAKHAL-317-F/305 — `ReproductionEditController.editPregnancyDiagnosis`. No dedicated GET-by-id
   * route exists for a `PregnancyDiagnosis`; the edit dialog seeds its form from the unified events
   * feed's own row (`ReproEventEntry.details`) instead. */
  editPregnancyDiagnosis(id: string, input: EditPregnancyDiagnosisInput): Promise<PregnancyRow> {
    return apiFetch<PregnancyRow>(`/reproduction/pregnancy-diagnoses/${id}`, { method: "PATCH", body: input });
  },

  calvingEvents(cattleId?: string, cursor?: string, limit = 20): Promise<CursorPage<CalvingEventRow>> {
    return apiFetchPage<CalvingEventRow>("/reproduction/calving-events", {
      searchParams: { cattleId, cursor, limit },
    });
  },
  /** RAKHAL-297-F: return type widened to `CreateCalvingEventResult` — the backend now also returns
   * `closedMissingDryOffLactation` (RAKHAL-290) when the dam still had an ACTIVE lactation. */
  createCalvingEvent(input: CreateCalvingEventInput): Promise<CreateCalvingEventResult> {
    return apiFetch<CreateCalvingEventResult>("/reproduction/calving-events", { method: "POST", body: input });
  },

  abortionEvents(cattleId?: string, cursor?: string, limit = 20): Promise<CursorPage<AbortionEventRow>> {
    return apiFetchPage<AbortionEventRow>("/reproduction/abortion-events", {
      searchParams: { cattleId, cursor, limit },
    });
  },
  createAbortionEvent(input: CreateAbortionEventInput): Promise<AbortionEventRow> {
    return apiFetch<AbortionEventRow>("/reproduction/abortion-events", { method: "POST", body: input });
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

  /** RD-038 + RAKHAL-274 — `cattleId` is the route param, not part of the body. */
  recordDryOff(cattleId: string, input: CreateDryOffInput): Promise<DryPeriodRow> {
    return apiFetch<DryPeriodRow>(`/reproduction/cattle/${cattleId}/dry-off`, { method: "POST", body: input });
  },
  /** RAKHAL-285/297-F — farmer-set target dry-off date, lighter-weight than `recordDryOff` (doesn't
   * end the lactation). `plannedDryOffAt: null` clears it back to unset. */
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
