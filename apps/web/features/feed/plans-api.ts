"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type { ConfirmFeedGridResult, SaveFeedGridDraftResult } from "./types";
import type {
  ApplyFeedPlanPayload,
  ApplyFeedPlanResult,
  CattleFeedProgram,
  CreateFeedPlanPayload,
  ProgramGridPayload,
  FeedPlan,
  FeedPlanAssignment,
  FeedPlanFitResult,
  UpdateFeedPlanPayload,
} from "./plans-types";

/** `/feed/plans`, `/feed/plan-assignments`, `/feed/cattle/:id/program` — MILESTONE 27 (RFE-126).
 * Reads are worker-ok (`feed.read`); create/update/delete/apply/remove are manager+. Lists are cursor
 * paginated. */
export const feedPlansApi = {
  listPlans(params: {
    search?: string;
    includeArchived?: boolean;
    limit?: number;
    cursor?: string;
  }): Promise<CursorPage<FeedPlan>> {
    return apiFetchPage<FeedPlan>("/feed/plans", { searchParams: params });
  },
  getPlan(id: string): Promise<FeedPlan> {
    return apiFetch<FeedPlan>(`/feed/plans/${id}`);
  },
  createPlan(dto: CreateFeedPlanPayload): Promise<FeedPlan> {
    return apiFetch<FeedPlan>("/feed/plans", { method: "POST", body: dto });
  },
  /** `lines`, when sent, replaces the whole line set. */
  updatePlan(id: string, dto: UpdateFeedPlanPayload): Promise<FeedPlan> {
    return apiFetch<FeedPlan>(`/feed/plans/${id}`, { method: "PATCH", body: dto });
  },
  /** 409 while applied, unless `removeAssignments` ("Remove from all & delete"). */
  archivePlan(id: string, removeAssignments = false): Promise<{ id: string; archived: boolean; removed_assignments: number }> {
    return apiFetch(`/feed/plans/${id}`, {
      method: "DELETE",
      searchParams: removeAssignments ? { removeAssignments: true } : undefined,
    });
  },
  /** Supply vs requirement per cow. `cattleIds` may be omitted only when the plan has a "made for" cow. */
  getPlanFit(id: string, params: { cattleIds?: string[]; date?: string }): Promise<FeedPlanFitResult> {
    return apiFetch<FeedPlanFitResult>(`/feed/plans/${id}/fit`, {
      searchParams: {
        cattleIds: params.cattleIds?.length ? params.cattleIds.join(",") : undefined,
        date: params.date,
      },
    });
  },
  /** Replaces the target's active program in one transaction. A group overlap is a 409 whose
   * `ApiError.details.conflicting_cattle` lists the cows. */
  applyPlan(id: string, dto: ApplyFeedPlanPayload): Promise<ApplyFeedPlanResult> {
    return apiFetch<ApplyFeedPlanResult>(`/feed/plans/${id}/apply`, { method: "POST", body: dto });
  },
  removeAssignment(assignmentId: string): Promise<FeedPlanAssignment> {
    return apiFetch<FeedPlanAssignment>(`/feed/plan-assignments/${assignmentId}/remove`, { method: "POST" });
  },
  listAssignments(params: {
    planId?: string;
    cattleId?: string;
    animalGroupId?: string;
    status?: "ACTIVE" | "ENDED";
    limit?: number;
  }): Promise<CursorPage<FeedPlanAssignment>> {
    return apiFetchPage<FeedPlanAssignment>("/feed/plan-assignments", { searchParams: params });
  },
  /** The program this cow is on right now, or `{ program: null }`. */
  getCattleProgram(cattleId: string): Promise<CattleFeedProgram> {
    return apiFetch<CattleFeedProgram>(`/feed/cattle/${cattleId}/program`);
  },
  /** Multi-line draft save (RAKHAL-457): one row per (cow, source), each remembering its plan line. */
  saveProgramDraft(dto: ProgramGridPayload): Promise<SaveFeedGridDraftResult> {
    return apiFetch<SaveFeedGridDraftResult>("/feed/grid/draft", { method: "POST", body: dto });
  },
  /** Multi-line confirm (RAKHAL-457): stock moves once per source across all lines; plan snapshots are written. */
  confirmProgram(dto: ProgramGridPayload): Promise<ConfirmFeedGridResult> {
    return apiFetch<ConfirmFeedGridResult>("/feed/grid/confirm", { method: "POST", body: dto });
  },
};
