"use client";

import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { reproductionApi } from "../api";
import type { ReproductiveStatus } from "../types";
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
  EditHeatEventInput,
  EditPregnancyDiagnosisInput,
  ResolveHeatEventInput,
  VoidBreedingEventInput,
  RecordProtocolAiInput,
  RecordProtocolOutcomeInput,
  ReturnToHeatInput,
} from "../schemas";
import type {
  CreateProtocolPayload,
  ProtocolInstanceListFilters,
  ReproEventsQuery,
  UpdateProtocolPayload,
} from "../types";

const STALE_TIME = 60_000;

/** Every create/edit mutation below touches the dashboard KPIs, the unified events feed and the
 * reproduction cow list (a breeding/heat/check changes a cow's status, next action and days), so each
 * `onSuccess` invalidates all three prefixes in addition to its own specific list. The cow list was
 * missing here, so it only updated after a page refresh. */
function invalidateReproductionCore(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ["reproduction", "dashboard"] });
  queryClient.invalidateQueries({ queryKey: ["reproduction", "events"] });
  queryClient.invalidateQueries({ queryKey: ["reproduction", "cows"] });
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

/** Breeding-event history (AI/natural service) for one cow — used by the cattle-detail Reproduction
 * tab, which previously showed calving history only, with no record of the breedings that led to it. */
export function useCattleBreedingEvents(cattleId?: string) {
  return useQuery({
    queryKey: qk.reproduction.breedingEvents(cattleId),
    queryFn: () => reproductionApi.breedingEvents(cattleId),
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

/** RAKHAL-363: OPEN/BRED_AWAITING_CONFIRMATION/PREGNANT cow list, cursor "load more" via `DataTable`
 * (same `useInfiniteQuery` contract `useMilkQualityTests` established). Replaces the dashboard-embedded
 * `open_cows[]` list as the Reproduction page's cow-list data source. */
export function useReproductionCows(status?: ReproductiveStatus) {
  return useInfiniteQuery({
    queryKey: qk.reproduction.cows(status),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      reproductionApi.reproductionCows(status, pageParam, 20),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNextPage ? lastPage.meta.endCursor : undefined),
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

export function useEditHeatEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: EditHeatEventInput }) => reproductionApi.editHeatEvent(id, input),
    onSuccess: () => invalidateReproductionCore(queryClient),
  });
}

export function useCancelHeatEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input?: { reason?: string } }) =>
      reproductionApi.cancelHeatEvent(id, input),
    onSuccess: () => {
      invalidateReproductionCore(queryClient);
      queryClient.invalidateQueries({ queryKey: ["reproduction", "heat-events"] });
      queryClient.invalidateQueries({ queryKey: ["cattle"] });
    },
  });
}

export function useResolveHeatEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: ResolveHeatEventInput }) =>
      reproductionApi.resolveHeatEvent(id, input),
    onSuccess: () => invalidateReproductionCore(queryClient),
  });
}

/** Voiding reverses money + straw and reopens a heat, so besides the core lists it refreshes the
 * breeding lists and the cow-finance / inventory views that show those numbers. */
export function useVoidBreedingEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: VoidBreedingEventInput }) =>
      reproductionApi.voidBreedingEvent(id, input),
    onSuccess: () => {
      invalidateReproductionCore(queryClient);
      queryClient.invalidateQueries({ queryKey: ["reproduction", "breeding-events"] });
      queryClient.invalidateQueries({ queryKey: ["reproduction", "heat-events"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["cattle"] });
      queryClient.invalidateQueries({ queryKey: ["finance"] });
    },
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

/** Cursor "load more" (RAKHAL-407 follow-up) — same `useInfiniteQuery` contract
 * `useReproductionCows`/`useMilkQualityTests` established. */
export function useProtocols() {
  return useInfiniteQuery({
    queryKey: qk.reproduction.protocols(),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) => reproductionApi.protocols(pageParam, 10),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNextPage ? lastPage.meta.endCursor : undefined),
    staleTime: STALE_TIME,
  });
}

/** Step definitions (day_number/title/instruction) for one protocol — used by the instance
 * timeline to render the day-by-day plan. */
export function useProtocol(id?: string) {
  return useQuery({
    queryKey: qk.reproduction.protocol(id ?? ""),
    queryFn: () => reproductionApi.protocol(id!),
    enabled: Boolean(id),
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

/** Cursor "load more" for the protocol instances list (applied cows) — same pattern as
 * `useProtocols`/`useReproductionCows`. */
export function useProtocolInstances(filters: ProtocolInstanceListFilters) {
  return useInfiniteQuery({
    queryKey: qk.reproduction.protocolInstances({
      protocolId: filters.protocolId,
      cattleId: filters.cattleId,
      status: filters.status,
    }),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      reproductionApi.protocolInstances(filters, pageParam, 10),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => (lastPage.meta.hasNextPage ? lastPage.meta.endCursor : undefined),
    staleTime: STALE_TIME,
  });
}

/** Backs the "Apply Protocol" dialog's auto-opened timeline sheet (user request, no ticket #). */
export function useProtocolInstance(id?: string) {
  return useQuery({
    queryKey: qk.reproduction.protocolInstance(id),
    queryFn: () => reproductionApi.protocolInstance(id!),
    enabled: Boolean(id),
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

/** RAKHAL-407 — invalidates both the summary list (`step_count`/`editable`) and the detail cache
 * for this new protocol's id, so a just-created protocol's edit form reads fresh if opened right after. */
export function useCreateProtocol() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateProtocolPayload) => reproductionApi.createProtocol(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reproduction", "protocols"] });
    },
  });
}

export function useUpdateProtocol() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProtocolPayload }) =>
      reproductionApi.updateProtocol(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reproduction", "protocols"] });
    },
  });
}

export function useDeleteProtocol() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => reproductionApi.deleteProtocol(id),
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
