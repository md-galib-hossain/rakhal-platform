"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { useCursorPager } from "@/lib/hooks/use-cursor-pager";
import { feedPlansApi } from "../plans-api";
import type {
  ApplyFeedPlanPayload,
  CreateFeedPlanPayload,
  ProgramGridPayload,
  UpdateFeedPlanPayload,
} from "../plans-types";

const STALE_TIME = 30_000;

/** Applying/removing a program changes what the Feeding Grid, the cow's Feeding tab, today's requirement
 * and the DMI/ration lookups resolve — refresh them all, not just the plan list. */
function useInvalidatePrograms() {
  const queryClient = useQueryClient();
  return () => {
    for (const key of [
      ["feed", "plans"],
      ["feed", "program"],
      ["feed", "grid"],
      ["feed", "today-requirement"],
      ["feed", "dmi"],
      ["feed", "resolved-ration"],
    ]) {
      void queryClient.invalidateQueries({ queryKey: key });
    }
  };
}

export function useFeedPlansList(filters: { search?: string; includeArchived?: boolean }) {
  return useCursorPager(
    qk.feed.plans({ search: filters.search, includeArchived: filters.includeArchived }),
    (cursor, limit) => feedPlansApi.listPlans({ ...filters, cursor, limit }),
    { staleTime: STALE_TIME, initialPageSize: 20 },
  );
}

export function useFeedPlan(id: string | undefined) {
  return useQuery({
    queryKey: qk.feed.planDetail(id ?? ""),
    queryFn: () => feedPlansApi.getPlan(id as string),
    enabled: Boolean(id),
    staleTime: STALE_TIME,
  });
}

/** Live fit table: what the plan supplies vs each reference cow's requirement. Off until a cow is picked. */
export function useFeedPlanFit(planId: string | undefined, cattleIds: string[]) {
  return useQuery({
    queryKey: qk.feed.planFit(planId ?? "", cattleIds),
    queryFn: () => feedPlansApi.getPlanFit(planId as string, { cattleIds }),
    enabled: Boolean(planId) && cattleIds.length > 0,
    staleTime: STALE_TIME,
  });
}

/** Where a plan is applied right now (active assignments only), for the card and the "Remove" buttons. */
export function useFeedPlanAssignments(planId: string | undefined) {
  return useQuery({
    queryKey: qk.feed.planAssignments(planId ?? ""),
    queryFn: () => feedPlansApi.listAssignments({ planId, status: "ACTIVE", limit: 100 }),
    enabled: Boolean(planId),
    staleTime: STALE_TIME,
  });
}

export function useCattleProgram(cattleId: string | undefined) {
  return useQuery({
    queryKey: qk.feed.cattleProgram(cattleId ?? ""),
    queryFn: () => feedPlansApi.getCattleProgram(cattleId as string),
    enabled: Boolean(cattleId),
    staleTime: STALE_TIME,
  });
}

export function useCreateFeedPlan() {
  const invalidate = useInvalidatePrograms();
  return useMutation({
    mutationFn: (dto: CreateFeedPlanPayload) => feedPlansApi.createPlan(dto),
    onSuccess: invalidate,
  });
}

export function useUpdateFeedPlan() {
  const invalidate = useInvalidatePrograms();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: UpdateFeedPlanPayload }) => feedPlansApi.updatePlan(id, dto),
    onSuccess: invalidate,
  });
}

export function useArchiveFeedPlan() {
  const invalidate = useInvalidatePrograms();
  return useMutation({
    mutationFn: ({ id, removeAssignments }: { id: string; removeAssignments?: boolean }) =>
      feedPlansApi.archivePlan(id, removeAssignments),
    onSuccess: invalidate,
  });
}

export function useApplyFeedPlan() {
  const invalidate = useInvalidatePrograms();
  return useMutation({
    mutationFn: ({ id, dto }: { id: string; dto: ApplyFeedPlanPayload }) => feedPlansApi.applyPlan(id, dto),
    onSuccess: invalidate,
  });
}

export function useRemoveFeedAssignment() {
  const invalidate = useInvalidatePrograms();
  return useMutation({
    mutationFn: (assignmentId: string) => feedPlansApi.removeAssignment(assignmentId),
    onSuccess: invalidate,
  });
}

/** Save a program section's staged lines — no inventory effect. */
export function useSaveProgramDraft() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: ProgramGridPayload) => feedPlansApi.saveProgramDraft(dto),
    onSuccess: (_d, v) => {
      void queryClient.invalidateQueries({ queryKey: qk.feed.grid(v.date) });
    },
  });
}

/** "Confirm as planned" / confirm a section: feeding actually happened — stock moves, so refresh everything
 * the plain grid confirm refreshes (stock, distributions, efficiency, today's requirement, cow history). */
export function useConfirmProgram() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (dto: ProgramGridPayload) => feedPlansApi.confirmProgram(dto),
    onSuccess: (_d, v) => {
      void queryClient.invalidateQueries({ queryKey: qk.feed.grid(v.date) });
      void queryClient.invalidateQueries({ queryKey: qk.feed.stock() });
      void queryClient.invalidateQueries({ queryKey: qk.feed.todaysRequirement() });
      for (const key of ["distributions", "efficiency", "dmi"]) {
        void queryClient.invalidateQueries({
          predicate: (query) => query.queryKey[0] === "feed" && query.queryKey[1] === key,
        });
      }
      void queryClient.invalidateQueries({ queryKey: ["inventory"] });
    },
  });
}
