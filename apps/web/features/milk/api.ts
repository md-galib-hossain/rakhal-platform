"use client";

import { apiFetch } from "@/lib/api/client";
import type {
  MilkAnomaliesResponse,
  MilkLogTableResponse,
  MilkOverviewResponse,
  ReviewAnomalyInput,
  SaveMilkLogInput,
  SaveMilkLogResponse,
  SubmitMilkInput,
  SubmitMilkResponse,
} from "./types";

/** `/milk/*` — real backend routes (`milk.controller.ts`), all `milk.read`/`milk.log`/`milk.update`-gated. */
export const milkApi = {
  overview(date?: string): Promise<MilkOverviewResponse> {
    return apiFetch<MilkOverviewResponse>("/milk/overview", { searchParams: { date } });
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
  reviewAnomaly(id: string, input: ReviewAnomalyInput): Promise<unknown> {
    return apiFetch(`/milk/anomalies/${id}/review`, { method: "POST", body: input });
  },
};
