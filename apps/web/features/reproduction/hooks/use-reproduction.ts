"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { reproductionApi } from "../api";
import type {
  ApplyProtocolInput,
  CloseProtocolInstanceInput,
  CreateAbortionEventInput,
  CreateBreedingEventInput,
  CreateCalvingEventInput,
  CreateDryOffInput,
  CreateHeatEventInput,
  CreatePregnancyDiagnosisInput,
  EditBreedingEventInput,
  EditPregnancyDiagnosisInput,
  RecordProtocolAiInput,
  RecordProtocolOutcomeInput,
  ReturnToHeatInput,
} from "../schemas";
import type { ProtocolInstanceListFilters, ReproEventsQuery } from "../types";

const STALE_TIME = 60_000;

/** Every create mutation below touches the dashboard KPIs and the unified events feed, so each
 * `onSuccess` invalidates both prefixes in addition to its own specific list. */
function invalidateReproductionCore(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["reproduction", "dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["reproduction", "events"] });
}

export function useReproductionDashboard() {
  return useQuery({
    queryKey: qk.reproduction.dashboard(),
    queryFn: () => reproductionApi.dashboard(),
    staleTime: STALE_TIME,
  });
}

/** RAKHAL-297-F — the one ACTIVE `Lactation` for a cow (there is at most one by construction,
 * RAKHAL-290), used to prefill the Dry-off dialog's suggested/planned dates. Small dedicated query
 * rather than a full `useLactations` list hook (out of scope here — that's RAKHAL-291-F's lane). */
export function useActiveLactation(cattleId?: string) {
  return useQuery({
    queryKey: qk.reproduction.lactations(cattleId),
    queryFn: () => reproductionApi.lactations(cattleId),
    select: (page) => page.items.find((l) => l.status === "ACTIVE") ?? null,
    enabled: Boolean(cattleId),
    staleTime: STALE_TIME,
  });
}

/** RAKHAL-317-F — the one ACTIVE `Pregnancy` for a cow, used to surface the calculated-vs-expected
 * calving date comparison on the Reproduction tab. Mirrors `useActiveLactation`'s shape. */
export function useActivePregnancy(cattleId?: string) {
  return useQuery({
    queryKey: qk.reproduction.pregnancies(cattleId),
    queryFn: () => reproductionApi.pregnancies(cattleId),
    select: (page) => page.items.find((p) => p.status === "ACTIVE") ?? null,
    enabled: Boolean(cattleId),
    staleTime: STALE_TIME,
  });
}

export function useReproductionEvents(query: ReproEventsQuery) {
  return useQuery({
    queryKey: qk.reproduction.events({
      cattleId: query.cattleId,
      eventType: query.eventType,
      fromDate: query.fromDate,
      toDate: query.toDate,
      limit: query.limit,
    }),
    queryFn: () => reproductionApi.events(query),
    staleTime: STALE_TIME,
  });
}

export function useCreateHeatEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateHeatEventInput) => reproductionApi.createHeatEvent(input),
    onSuccess: () => invalidateReproductionCore(queryClient),
  });
}

export function useCreateBreedingEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateBreedingEventInput) => reproductionApi.createBreedingEvent(input),
    onSuccess: () => invalidateReproductionCore(queryClient),
  });
}

/** Fetches the full row to prefill the edit dialog — the events feed's own `details` is a
 * stripped summary, not enough to populate a form. */
export function useBreedingEvent(id?: string) {
  return useQuery({
    queryKey: qk.reproduction.breedingEventDetail(id),
    queryFn: () => reproductionApi.breedingEvent(id!),
    enabled: Boolean(id),
  });
}

export function useEditBreedingEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EditBreedingEventInput }) =>
      reproductionApi.editBreedingEvent(id, input),
    onSuccess: () => {
      invalidateReproductionCore(queryClient);
      queryClient.invalidateQueries({ queryKey: ["reproduction", "breeding-events"] });
    },
  });
}

/** RAKHAL-316: also invalidates the Task Hub list — closes the superseded pregnancy-check task
 * and, once a follow-up AI is recorded, its own new one shows up there. */
export function useReturnToHeat() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ breedingEventId, input }: { breedingEventId: string; input: ReturnToHeatInput }) =>
      reproductionApi.returnToHeat(breedingEventId, input),
    onSuccess: () => {
      invalidateReproductionCore(queryClient);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export function useCreatePregnancyDiagnosis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreatePregnancyDiagnosisInput) => reproductionApi.createPregnancyDiagnosis(input),
    onSuccess: () => invalidateReproductionCore(queryClient),
  });
}

/** RAKHAL-317-F/305 */
export function useEditPregnancyDiagnosis() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EditPregnancyDiagnosisInput }) =>
      reproductionApi.editPregnancyDiagnosis(id, input),
    onSuccess: () => invalidateReproductionCore(queryClient),
  });
}

export function useCreateCalvingEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCalvingEventInput) => reproductionApi.createCalvingEvent(input),
    onSuccess: () => invalidateReproductionCore(queryClient),
  });
}

export function useCreateAbortionEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateAbortionEventInput) => reproductionApi.createAbortionEvent(input),
    onSuccess: () => invalidateReproductionCore(queryClient),
  });
}

/** RD-038 + RAKHAL-274. Also invalidates `lactations` — a dry-off ends the cow's active lactation. */
export function useRecordDryOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ cattleId, input }: { cattleId: string; input: CreateDryOffInput }) =>
      reproductionApi.recordDryOff(cattleId, input),
    onSuccess: () => {
      invalidateReproductionCore(queryClient);
      queryClient.invalidateQueries({ queryKey: ["reproduction", "lactations"] });
    },
  });
}

/** RAKHAL-285/297-F — lighter-weight than `useRecordDryOff`: only writes `plannedDryOffAt`, doesn't
 * end the lactation. */
export function useUpdatePlannedDryOff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ lactationId, plannedDryOffAt }: { lactationId: string; plannedDryOffAt: string | null }) =>
      reproductionApi.updatePlannedDryOff(lactationId, plannedDryOffAt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reproduction", "lactations"] });
    },
  });
}

export function useProtocols() {
  return useQuery({
    queryKey: qk.reproduction.protocols(),
    queryFn: () => reproductionApi.protocols(),
    staleTime: STALE_TIME,
  });
}

export function useProtocolKpis() {
  return useQuery({
    queryKey: qk.reproduction.protocolKpis(),
    queryFn: () => reproductionApi.protocolKpis(),
    staleTime: STALE_TIME,
  });
}

export function useProtocolInstances(filters: ProtocolInstanceListFilters) {
  return useQuery({
    queryKey: qk.reproduction.protocolInstances({
      protocolId: filters.protocolId,
      cattleId: filters.cattleId,
      status: filters.status,
    }),
    queryFn: () => reproductionApi.protocolInstances(filters),
    staleTime: STALE_TIME,
  });
}

export function useApplyProtocol() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ApplyProtocolInput) => reproductionApi.applyProtocol(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reproduction", "protocols"] });
    },
  });
}

export function useRecordProtocolAi() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId, input }: { instanceId: string; input: RecordProtocolAiInput }) =>
      reproductionApi.recordProtocolAi(instanceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reproduction", "protocols"] });
    },
  });
}

export function useRecordProtocolOutcome() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId, input }: { instanceId: string; input: RecordProtocolOutcomeInput }) =>
      reproductionApi.recordProtocolOutcome(instanceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reproduction", "protocols"] });
    },
  });
}

export function useCloseProtocolInstance() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ instanceId, input }: { instanceId: string; input: CloseProtocolInstanceInput }) =>
      reproductionApi.closeProtocolInstance(instanceId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reproduction", "protocols"] });
    },
  });
}
