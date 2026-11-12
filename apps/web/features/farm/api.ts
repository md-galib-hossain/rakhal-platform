"use client";

import { apiFetch } from "@/lib/api/client";
import type { FarmSummary } from "./types";

/** `GET /farms` — real backend route (`lib/auth/session.ts`'s login bootstrap already calls it to list
 * a user's farms). Not cursor-paginated, plain array. Used here only to resolve the current farm's
 * display name/slug for the sidebar — switching farms post-login is still unbuilt (see OrgSwitcher). */
export const farmApi = {
  list(): Promise<FarmSummary[]> {
    return apiFetch<FarmSummary[]>("/farms");
  },
};
