"use client";

import { apiFetch, apiFetchPage, apiUpload } from "@/lib/api/client";
import type { CursorPage } from "@/types/api";
import type {
  CreateMilkQualityTestInput,
  ExportMilkLogInput,
  ListMilkQualityTestsParams,
  MilkAnomaliesResponse,
  MilkEligibility,
  MilkImportConfirmResult,
  MilkImportPreview,
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
  saveLog(input: SaveMilkLogInput): Promise<SaveMilkLogResponse> {
    return apiFetch<SaveMilkLogResponse>("/milk/log", { method: "POST", body: input });
  },
  submit(input: SubmitMilkInput): Promise<SubmitMilkResponse> {
    return apiFetch<SubmitMilkResponse>("/milk/submit", { method: "POST", body: input });
  },
  anomalies(date?: string): Promise<MilkAnomaliesResponse> {
    return apiFetch<MilkAnomaliesResponse>("/milk/anomalies", { searchParams: { date } });
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
  importPreview(file: File): Promise<MilkImportPreview> {
    return apiUpload<MilkImportPreview>("/milk/import/preview", file);
  },
  importConfirm(importSessionId: string, skipErrors: boolean): Promise<MilkImportConfirmResult> {
    return apiFetch<MilkImportConfirmResult>("/milk/import/confirm", {
      method: "POST",
      body: { importSessionId, skipErrors },
    });
  },
  // Bypasses `apiFetch` (JSON-envelope only) — hits the bespoke same-origin proxy route
  // (`app/api/milk/export/route.ts`) that byte-streams the raw .xlsx back, same reason
  // Reports' download link does (see that route's own comment).
  async exportLog(input: ExportMilkLogInput): Promise<Blob> {
    const res = await fetch("/api/milk/export", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || `Export failed (${res.status})`);
    }
    return res.blob();
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
