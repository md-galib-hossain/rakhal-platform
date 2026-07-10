"use client";

import { apiFetch } from "@/lib/api/client";
import type { SubscriptionSummary } from "./types";

/** `GET /subscription` needs only `JwtAuthGuard, SessionGuard, FarmContextGuard` (no
 * `PermissionGuard`) — any farm member, worker included, can read the farm's own entitlement
 * status, since an expired farm still needs to see why it's read-only. Safe through the generic
 * `/api/backend/[...path]` proxy. */
export const subscriptionApi = {
  current(): Promise<SubscriptionSummary> {
    return apiFetch<SubscriptionSummary>("/subscription");
  },
};
