"use client";

import { apiFetch, apiFetchPage } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  CreateMilkQualityTestInput,
  EntryCalendarResult,
  ListMilkQualityTestsParams,
  MilkAnomaliesResponse,
  MilkAnomaly,
  MilkEligibility,
  MilkLogTableResponse,
  MilkOverviewResponse,
  MilkTrendRange,
  MilkQualityTest,
  ReviewAnomalyInput,
  SaveMilkLogInput,
  SaveMilkLogResponse,
  SubmitMilkInput,
  SubmitMilkResponse,
  UpdateMilkSessionsInput,
  UpdateMilkSessionsResponse,
} from "./types";

/** `/milk/*` — real backend routes (`milk.controller.ts`), all `milk.read`/`milk.log`/`milk.update`-gated. */
export const milkApi = {
  overview(date?: string, range?: MilkTrendRange): Promise<MilkOverviewResponse> {
    return apiFetch<MilkOverviewResponse>("/milk/overview", { searchParams: { date, range } });
  },
  logTable(params: { date?: string; shedId?: string }): Promise<MilkLogTableResponse> {
    return apiFetch<MilkLogTableResponse>("/milk/log", { searchParams: params });
  },
  /** RAKHAL-434 — per-day entry status for the missed-entry calendar picker. */
  getLogCalendar(month: string): Promise<EntryCalendarResult> {
    return apiFetch<EntryCalendarResult>("/milk/log/calendar", { searchParams: { month } });
  },
  saveLog(input: SaveMilkLogInput): Promise<SaveMilkLogResponse> {
    return apiFetch<SaveMilkLogResponse>("/milk/log", { method: "POST", body: input });
  },
  submit(input: SubmitMilkInput): Promise<SubmitMilkResponse> {
    return apiFetch<SubmitMilkResponse>("/milk/submit", { method: "POST", body: input });
  },
  anomalies(params: { date?: string; cursor?: string; limit?: number }): Promise<MilkAnomaliesResponse> {
    return apiFetchPage<MilkAnomaly>("/milk/anomalies", { searchParams: params });
  },
  // RAKHAL-278 — `MilkController.eligibility()` → `MilkService.getMilkEligibility(farmId, cattleId)`.
  eligibility(cattleId: string): Promise<MilkEligibility> {
    return apiFetch<MilkEligibility>(`/milk/cattle/${cattleId}/eligibility`);
  },
  reviewAnomaly(id: string, input: ReviewAnomalyInput): Promise<unknown> {
    return apiFetch(`/milk/anomalies/${id}/review`, { method: "POST", body: input });
  },
  // Owner-only (`settings.milk-sessions-manage`) — a Manager gets a 403 here.
  updateSessions(input: UpdateMilkSessionsInput): Promise<UpdateMilkSessionsResponse> {
    return apiFetch<UpdateMilkSessionsResponse>("/settings/modules/milk-sessions", {
      method: "PATCH",
      body: input,
    });
  },

  // RAKHAL-282/293-F — `MilkController` quality-test routes (`milk.quality.create`/`milk.quality.read`).
  qualityTests({
    cattleId,
    lactationId,
    cursor,
    limit,
  }: ListMilkQualityTestsParams): Promise<CursorPage<MilkQualityTest>> {
    return apiFetchPage<MilkQualityTest>("/milk/quality-tests", {
      searchParams: { cattleId, lactationId, cursor, limit },
    });
  },
  createQualityTest(input: CreateMilkQualityTestInput): Promise<MilkQualityTest> {
    return apiFetch<MilkQualityTest>("/milk/quality-tests", { method: "POST", body: input });
  },
  latestQualityTest(cattleId: string): Promise<MilkQualityTest | null> {
    return apiFetch<MilkQualityTest | null>("/milk/quality-tests/latest", { searchParams: { cattleId } });
  },
};
