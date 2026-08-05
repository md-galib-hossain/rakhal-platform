"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  AbortionEventRow,
  ApplyProtocolResult,
  BreedingEventRow,
  CalvingEventRow,
  DryPeriodRow,
  HeatEventRow,
  LactationRow,
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
  RecordProtocolAiInput,
  RecordProtocolOutcomeInput,
  CloseProtocolInstanceInput,
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
  createCalvingEvent(input: CreateCalvingEventInput): Promise<CalvingEventRow> {
    return apiFetch<CalvingEventRow>("/reproduction/calving-events", { method: "POST", body: input });
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

  /** RD-038 + RAKHAL-274 — `cattleId` is the route param, not part of the body. */
  recordDryOff(cattleId: string, input: CreateDryOffInput): Promise<DryPeriodRow> {
    return apiFetch<DryPeriodRow>(`/reproduction/cattle/${cattleId}/dry-off`, { method: "POST", body: input });
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
