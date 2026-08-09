"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  AbortionEventRow,
  ApplyProtocolResult,
  BreedingEventRow,
  CalvingEventRow,
  CreateCalvingEventResult,
  DryPeriodRow,
  HeatEventRow,
  LactationCompareResponse,
  LactationComparisonGroupBy,
  LactationCurveResponse,
  LactationGroupBucketResult,
  LactationRow,
  LactationStatsResponse,
  PregnancyRow,
  ProtocolDetail,
  ProtocolInstance,
  ProtocolInstanceListFilters,
  ProtocolKpis,
  ProtocolSummary,
  ReproDashboardResponse,
  ReproEventEntry,
  ReproEventsQuery,
} from "./types";
import type {
  CreateAbortionEventInput,
  CreateBreedingEventInput,
  CreateCalvingEventInput,
  CreateDryOffInput,
  CreateHeatEventInput,
  CreatePregnancyDiagnosisInput,
  EditBreedingEventInput,
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
  /** The backend's response interceptor hoists this route's `{items, meta}` service return into
   * the standard `{data: items[], meta}` envelope (verified live) — same shape `apiFetchPage`
   * already models, just with `{total, limit}` meta instead of the usual cursor fields. */
  events(query: ReproEventsQuery): Promise<CursorPage<ReproEventEntry>> {
    return apiFetchPage<ReproEventEntry>("/reproduction/events", {
      searchParams: {
        cattleId: query.cattleId,
        eventType: query.eventType,
        fromDate: query.fromDate,
        toDate: query.toDate,
        limit: query.limit,
      },
    });
  },

  heatEvents(cattleId?: string, cursor?: string, limit = 20): Promise<CursorPage<HeatEventRow>> {
    return apiFetchPage<HeatEventRow>("/reproduction/heat-events", { searchParams: { cattleId, cursor, limit } });
  },
  createHeatEvent(input: CreateHeatEventInput): Promise<HeatEventRow> {
    return apiFetch<HeatEventRow>("/reproduction/heat-events", { method: "POST", body: input });
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
  /** RAKHAL-316: farmer-confirmed return to heat before a pregnancy check was due — creates a real
   * `HeatEvent`, never a fake `PregnancyDiagnosis`. */
  returnToHeat(breedingEventId: string, input: ReturnToHeatInput): Promise<HeatEventRow> {
    return apiFetch<HeatEventRow>(`/reproduction/breeding-events/${breedingEventId}/return-to-heat`, {
      method: "POST",
      body: input,
    });
  },

  pregnancies(cattleId?: string, cursor?: string, limit = 20): Promise<CursorPage<PregnancyRow>> {
    return apiFetchPage<PregnancyRow>("/reproduction/pregnancies", { searchParams: { cattleId, cursor, limit } });
  },
  createPregnancyDiagnosis(input: CreatePregnancyDiagnosisInput): Promise<PregnancyRow> {
    return apiFetch<PregnancyRow>("/reproduction/pregnancy-diagnoses", { method: "POST", body: input });
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
  protocols(): Promise<ProtocolSummary[]> {
    return apiFetch<ProtocolSummary[]>("/reproduction/protocols");
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
  applyProtocol(input: { protocolId: string; cattleIds: string[]; startDate?: string }): Promise<ApplyProtocolResult> {
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
};
