"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { AlertTriangle } from "lucide-react";
import { useSubscription } from "@/features/subscription/hooks/use-subscription";
import { useIsReadOnly } from "@/features/subscription/hooks/use-subscription-gates";

const MESSAGE_KEY_BY_STATUS: Record<string, string> = {
  PAST_DUE: "pastDueMessage",
  EXPIRED: "expiredMessage",
  CANCELLED: "cancelledMessage",
  NONE: "noneMessage",
};

/**
 * App-wide read-only notice (RFE-008) — mirrors the backend's own `SubscriptionGuard`: ACTIVE/
 * TRIALING are full access, everything else (PAST_DUE/EXPIRED/CANCELLED/NONE) blocks mutating verbs
 * with a 403. This banner is the visible explanation for those 403s, not enforcement itself — the
 * backend already enforces it regardless of whether this renders. `text-foreground` for the body
 * (not `text-warning` — `#f59e0b` on `--warning-tint` measures ~2:1, fails WCAG AA; reserved the
 * warning color for the icon only, a non-text use where contrast rules don't apply the same way).
 */
export function ReadOnlyBanner() {
  const t = useTranslations("subscription");
  const { data } = useSubscription();
  const isReadOnly = useIsReadOnly();

  if (!isReadOnly || !data) return null;
  const messageKey = MESSAGE_KEY_BY_STATUS[data.status] ?? "noneMessage";

  return (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-xl border border-warning/40 bg-warning-tint px-4 py-3 text-sm text-foreground"
    >
      <AlertTriangle className="size-4 shrink-0 text-warning" aria-hidden />
      <p className="flex-1">{t(messageKey)}</p>
      <Link href="/subscription" className="shrink-0 font-semibold underline underline-offset-2 hover:no-underline">
        {t("renewCta")}
      </Link>
    </div>
  );
}
