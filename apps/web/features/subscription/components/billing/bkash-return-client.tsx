"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { qk } from "@/lib/query/keys";
import { subscriptionApi } from "../../api";

const USABLE_STATUSES = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);
const POLL_INTERVAL_MS = 2000;
const POLL_TIMEOUT_MS = 30_000;

/**
 * Polls the real `GET /subscription` (never the `?status=` query param — that's the gateway's own
 * claim, not verified state) until the farm's entitlement flips to a usable status or the timeout
 * elapses. `status=failed` from the backend means the gateway confirm failed server-side; still
 * verified against `/subscription` rather than trusted outright, in case a retry already succeeded.
 *
 * Reads `?status=` via plain `window.location.search` rather than `next/navigation`'s
 * `useSearchParams()` — that value is cosmetic-only (which failure copy to show), never trusted for
 * real state, so it doesn't need router-integrated access; avoiding the hook also means this
 * component needs no `<Suspense>` boundary at the page level (a bare, non-async page wrapping a
 * `useSearchParams()` consumer was observed to leave its Suspense hole permanently unresolved).
 */
export function BkashReturnClient() {
  const t = useTranslations("billing");
  const router = useRouter();
  const queryClient = useQueryClient();
  const [gatewayStatus] = useState(() =>
    typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("status"),
  );

  const [outcome, setOutcome] = useState<"polling" | "success" | "failed">("polling");

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      while (!cancelled) {
        try {
          const sub = await subscriptionApi.current();
          if (USABLE_STATUSES.has(sub.status)) {
            if (!cancelled) {
              queryClient.setQueryData(qk.subscription.current(), sub);
              void queryClient.invalidateQueries({ queryKey: ["billing"] });
              setOutcome("success");
            }
            return;
          }
        } catch {
          // transient fetch failure — keep polling until the timeout
        }
        if (Date.now() - startedAt >= POLL_TIMEOUT_MS) {
          if (!cancelled) setOutcome("failed");
          return;
        }
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    }

    void poll();
    return () => {
      cancelled = true;
    };
    // gatewayStatus intentionally excluded — it only informs copy, never the polled outcome.
  }, [queryClient]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
      {outcome === "polling" ? (
        <>
          <Loader2 className="size-10 animate-spin text-primary" aria-hidden />
          <p className="text-lg font-semibold text-foreground">{t("return.polling")}</p>
          <p className="text-sm text-muted-foreground">{t("return.pollingDescription")}</p>
        </>
      ) : outcome === "success" ? (
        <>
          <CheckCircle2 className="size-10 text-success" aria-hidden />
          <p className="text-lg font-semibold text-foreground">{t("return.success")}</p>
          <Button onClick={() => router.push("/settings?tab=billing")}>{t("return.backToSettings")}</Button>
        </>
      ) : (
        <>
          <XCircle className="size-10 text-destructive" aria-hidden />
          <p className="text-lg font-semibold text-foreground">
            {gatewayStatus === "failed" ? t("return.gatewayFailed") : t("return.timeout")}
          </p>
          <p className="text-sm text-muted-foreground">{t("return.failedDescription")}</p>
          <Button onClick={() => router.push("/settings?tab=billing")}>{t("return.backToSettings")}</Button>
        </>
      )}
    </div>
  );
}
