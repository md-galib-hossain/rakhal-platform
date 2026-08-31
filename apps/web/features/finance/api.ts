"use client";

import { apiFetch } from "@/lib/api/client";
import type { AssetsResponse, CreateFixedAssetPayload, LiabilitiesResponse } from "./types";

/** `/finance/*` — real backend routes (`finance.controller.ts`), `finance.*`-gated.
 * RAKHAL-394 (dead-code sweep): every other V1 route this object used to wrap (highlights, ledger,
 * settlements/receivables/payables, wallet, add-funds, withdraw, record-payment, void-transaction,
 * record-transaction) was dropped server-side in RAKHAL-354 and had zero real consumers left in the
 * frontend — Finance V2 (`api-v2.ts`) replaced all of it. Liabilities/Assets survive because they're
 * genuinely still V1-only: MILESTONE 22's PRD explicitly relocated them to URL-only routes rather
 * than porting them, so `financeApi.liabilities`/`assets`/`createAsset` stay live. */
export const financeApi = {
  liabilities(): Promise<LiabilitiesResponse> {
    return apiFetch<LiabilitiesResponse>("/finance/liabilities");
  },
  assets(): Promise<AssetsResponse> {
    return apiFetch<AssetsResponse>("/finance/assets");
  },
  createAsset(dto: CreateFixedAssetPayload) {
    return apiFetch("/finance/assets", { method: "POST", body: dto });
  },
};
