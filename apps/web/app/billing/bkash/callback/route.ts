import { NextRequest, NextResponse } from "next/server";
import { serverEnv } from "@/lib/env";

/**
 * bKash's own redirect target (RAKHAL-221) — the backend's `BKASH_CALLBACK_URL`
 * (`.env`) points the bKash gateway's browser redirect here (`localhost:3005`, since no
 * ngrok tunnel is set up for local dev — see that env var's comment). The REAL
 * verification logic (`BillingService.finalizePayment` — re-queries the gateway,
 * never trusts this redirect, PAY-02) lives only in the backend's own
 * `BkashCallbackController` (`GET /api/v1/billing/bkash/callback`). This route's only
 * job is a same-origin-browser passthrough: forward the exact query params
 * (`paymentID`/`status`/`signature`) to that real backend endpoint so finalize
 * actually runs, then let the backend's own redirect to `BKASH_RETURN_URL`
 * (`/billing/return`, which polls real subscription state) carry the browser the rest
 * of the way. No state is verified or mutated here — this route performs no
 * authorization decisions, it is a pure query-string forward.
 */
export async function GET(req: NextRequest) {
  const target = new URL(`${serverEnv.API_BASE_URL}/billing/bkash/callback`);
  target.search = req.nextUrl.search;
  return NextResponse.redirect(target);
}
