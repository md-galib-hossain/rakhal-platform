"use client"; // dashboard stats + feed-today dialog open state

import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { useFeedCostSummary, useTodaysRequirement } from "@/features/feed/hooks/use-feed";
import { FeedingGrid } from "./feeding-grid";

function StatTile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-xl border border-border bg-card p-3 shadow-xs">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <p className="text-xl font-semibold text-foreground">{value}</p>
      {sub ? <span className="text-xs text-muted-foreground">{sub}</span> : null}
    </div>
  );
}

/**
 * "Feeding" dashboard (2026-08-13, user request) — the dedicated daily-operations entry point
 * the doc's own §12/§13 mockup calls for, separate from `/feed` (Feed Formulator, where rations/
 * TMRs are *built*). Composes existing hooks/dialogs rather than adding new backend routes: today's
 * farm-wide feed requirement (`useTodaysRequirement`), feed cost summary (`useFeedCostSummary`), and
 * — at the top, replacing the old single-item Quick Feed dialog (2026-08-15) — the per-day,
 * per-cow `FeedingGrid`.
 */
export function FeedingView() {
  const t = useTranslations("feeding");
  const requirement = useTodaysRequirement();
  const costSummary = useFeedCostSummary(7);

  const isLoading = requirement.isLoading || costSummary.isLoading;
  const isError = requirement.isError || costSummary.isError;

  return (
    <div className="flex flex-col gap-5">
      {isLoading ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </div>
      ) : isError ? (
        <ErrorState onRetry={() => { requirement.refetch(); costSummary.refetch(); }} />
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <StatTile label={t("stats.todaysRequirement")} value={t("kgValue", { value: requirement.data?.grand_total_kg.toFixed(1) ?? "0" })} />
          <StatTile
            label={t("stats.costPerCowDay")}
            value={costSummary.data?.cost_per_cow_per_day != null ? t("currencyValue", { value: costSummary.data.cost_per_cow_per_day.toFixed(2) }) : "—"}
          />
          <StatTile
            label={t("stats.costPerLitre")}
            value={costSummary.data?.cost_per_litre != null ? t("currencyValue", { value: costSummary.data.cost_per_litre.toFixed(2) }) : "—"}
          />
          <StatTile label={t("stats.headcount")} value={String(costSummary.data?.headcount ?? 0)} />
        </div>
      )}

      <p className="text-sm text-muted-foreground">{t("subtitle")}</p>

      <FeedingGrid />
    </div>
  );
}
