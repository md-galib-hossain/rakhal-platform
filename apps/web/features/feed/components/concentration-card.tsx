"use client"; // opens the detail sheet on click

import { useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { MoneyText } from "@/components/shared/money-text";
import { balanceScoreBand } from "../lib/formula-math";
import type { FeedConcentrationSummary, FeedGroup } from "../types";

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex h-20 flex-1 flex-col items-center justify-between rounded-2xl border border-border bg-card p-2 text-center shadow-xs">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}

/**
 * One "Concentration Template"/"Feed Mixture" card (Figma `1048:33257`/`1048:33341`). The two Figma
 * sections are the same `FeedConcentration` resource (see `types.ts`'s doc comment) — this card
 * renders the Balance Score bar only when `balance_score` is present (a target was set). "Weight
 * Range (kg)"/"Avg. Daily Milk Yield (L)" render as single "Target Weight"/"Target Milk" values
 * (no range exists in the schema, see `types.ts`) — "Number of Cow" is the real target feed group's
 * `assigned_count` (1 for an Individual target).
 */
export function ConcentrationCard({
  concentration,
  feedGroup,
  onSeeDetails,
}: {
  concentration: FeedConcentrationSummary;
  feedGroup: FeedGroup | undefined;
  onSeeDetails: () => void;
}) {
  const t = useTranslations("feed.card");
  const cowCount = concentration.target_type === "INDIVIDUAL" ? 1 : (feedGroup?.assigned_count ?? "—");
  const band = concentration.balance_score != null ? balanceScoreBand(concentration.balance_score) : null;

  return (
    <div className="flex flex-1 flex-col gap-5 rounded-2xl border border-border bg-card p-4">
      <p className="text-xl font-bold text-foreground">{concentration.name}</p>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2.5">
          <p className="text-sm text-muted-foreground">{t("bestFor")}</p>
          <div className="flex gap-2 text-center">
            <StatBox label={t("numberOfCow")} value={cowCount} />
            <StatBox label={t("targetWeight")} value={concentration.target_weight_kg ?? "—"} />
            <StatBox label={t("targetMilk")} value={concentration.target_milk_l ?? "—"} />
            <StatBox label={t("feedDuration")} value={concentration.duration_days ?? "—"} />
          </div>
        </div>

        {concentration.balance_score != null && band ? (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">{t("balanceScore")}</p>
              <p
                className={cn(
                  "font-bold",
                  band === "success" ? "text-success" : band === "warning" ? "text-warning" : "text-destructive",
                )}
              >
                {concentration.balance_score}%
              </p>
            </div>
            <div className="h-3 w-full overflow-hidden rounded bg-muted">
              <div
                className={cn(
                  "h-full rounded",
                  band === "success" ? "bg-success" : band === "warning" ? "bg-warning" : "bg-destructive",
                )}
                style={{ width: `${Math.min(concentration.balance_score, 100)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-4 rounded-xl bg-card px-3 py-2 shadow-card">
        <div className="flex flex-col gap-1">
          <p className="text-xs text-muted-foreground">{t("totalCost")}</p>
          <p className="text-base font-bold text-foreground">
            <MoneyText amount={concentration.totals.total_cost_tk} />
          </p>
        </div>
        <button
          type="button"
          onClick={onSeeDetails}
          className="flex items-center gap-2 rounded-lg border-[1.5px] border-input px-4 py-2 text-sm font-bold text-muted-foreground transition-colors hover:bg-muted"
        >
          {t("seeDetails")}
          <ArrowRight className="size-[18px]" aria-hidden />
        </button>
      </div>
    </div>
  );
}
