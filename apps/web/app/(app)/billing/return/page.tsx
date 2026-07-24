import { BkashReturnClient } from "@/features/subscription/components/billing/bkash-return-client";

/**
 * bKash return landing (RAKHAL-221/RFE-036) — the exact path `BKASH_RETURN_URL` in the backend `.env`
 * points at (`http://localhost:3005/billing/return`). The backend's callback controller redirects
 * here with `?status=success|failed` after re-querying the gateway itself; it does **not** carry an
 * invoice id. We never trust that query param for state — it only decides which poll to start. The
 * client component polls `GET /subscription` (source of truth: `SubscriptionLifecycleService.activate`
 * only runs after the backend's own gateway-confirmed COMPLETED) until the plan reflects payment or a
 * timeout elapses, then routes back into Settings.
 */
export default function BkashReturnPage() {
  return <BkashReturnClient />;
}
