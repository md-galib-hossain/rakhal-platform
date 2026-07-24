"use client";

import { useTranslations } from "next-intl";
import { Settings2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MoneyText } from "@/components/shared/money-text";
import { DateText } from "@/components/shared/date-text";
import { Can } from "@/lib/auth/permissions";
import { useSubscription } from "../../hooks/use-subscription";
import { usePlans } from "../../hooks/use-billing";
import type { PublicPlan, SubscriptionSummary } from "../../types";

/** ACTIVE/TRIALING/PAST_DUE still have a usable plan to show; EXPIRED/CANCELLED/NONE do not. */
const USABLE = new Set(["ACTIVE", "TRIALING", "PAST_DUE"]);

/**
 * Figma "Current Plan" banner (node `1039:51250`) — dark-green hero (the app sidebar's `--sidebar`
 * green) carrying the plan name, ৳ price, and the Manage/Upgrade actions. Price isn't on
 * `GET /subscription`, so it's matched from `GET /plans` by `plan_id`. The mutating actions are
 * Owner-only (`subscription.manage`); a worker/manager sees the banner without the buttons.
 */
export function CurrentPlanCard({ onManage, onUpgrade }: { onManage: () => void; onUpgrade: () => void }) {
  const t = useTranslations("billing");
  const { data: sub, isLoading, isError } = useSubscription();
  const { data: plans } = usePlans();

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-foreground">{t("currentPlan.title")}</h3>
      <div className="rounded-2xl bg-sidebar p-6 text-sidebar-foreground shadow-card">
        {isLoading ? (
          <div className="flex flex-col gap-3">
            <div className="h-8 w-48 animate-pulse rounded bg-sidebar-foreground/20" />
            <div className="h-5 w-32 animate-pulse rounded bg-sidebar-foreground/10" />
          </div>
        ) : isError || !sub ? (
          <p className="text-sm text-sidebar-muted">{t("currentPlan.error")}</p>
        ) : (
          <PlanBanner sub={sub} plans={plans} onManage={onManage} onUpgrade={onUpgrade} />
        )}
      </div>
    </section>
  );
}

function PlanBanner({
  sub,
  plans,
  onManage,
  onUpgrade,
}: {
  sub: SubscriptionSummary;
  plans: PublicPlan[] | undefined;
  onManage: () => void;
  onUpgrade: () => void;
}) {
  const t = useTranslations("billing");
  const active = USABLE.has(sub.status) && !!sub.plan_id;
  const plan = plans?.find((p) => p.id === sub.plan_id);

  return (
    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
      <div className="flex flex-col gap-1">
        {active ? (
          <>
            <p className="text-2xl font-bold">{sub.plan_name}</p>
            {plan ? (
              <p className="text-base text-sidebar-muted">
                <MoneyText amount={plan.monthly_price} className="font-semibold text-sidebar-foreground" />{" "}
                {t("currentPlan.perMonth")}
              </p>
            ) : null}
            {sub.expires_at ? (
              <p className="text-xs text-sidebar-muted">
                {t("currentPlan.validUntil")} <DateText date={sub.expires_at} />
              </p>
            ) : null}
          </>
        ) : (
          <>
            <p className="text-2xl font-bold">{t("currentPlan.none")}</p>
            <p className="text-sm text-sidebar-muted">{t("currentPlan.noneDescription")}</p>
          </>
        )}
      </div>

      <Can I="subscription.manage">
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {active ? (
            <Button variant="inverse" size="sm" onClick={onManage} className="gap-1.5">
              <Settings2 className="size-4" aria-hidden />
              {t("currentPlan.manage")}
            </Button>
          ) : null}
          <Button
            size="sm"
            onClick={onUpgrade}
            className="gap-1.5 border border-transparent bg-primary text-white hover:bg-primary-hover"
          >
            <Sparkles className="size-4" aria-hidden />
            {active ? t("currentPlan.upgrade") : t("currentPlan.choosePlan")}
          </Button>
        </div>
      </Can>
    </div>
  );
}
