"use client"; // dashboard stats + feed-today dialog open state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Wheat } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { useConcentrations, useFeedCostSummary, useFeedGroups, useTodaysRequirement } from "@/features/feed/hooks/use-feed";
import { LogDistributionDialog } from "@/features/feed/components/log-distribution-dialog";
import type { FeedGroup } from "@/features/feed/types";
import { FeedingGrid } from "./feeding-grid";
import { FeedGroupsSection } from "./feed-groups-section";

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
 * farm-wide feed requirement (`useTodaysRequirement`), feed cost summary (`useFeedCostSummary`), a
 * per-group "Feed Today" quick-action list (reusing the existing `LogDistributionDialog`, keyed by
 * each group's own GROUP-targeted TMR if one exists), and — at the top, replacing the old single-item
 * Quick Feed dialog (2026-08-15) — the per-day, per-cow `FeedingGrid`.
 */
export function FeedingView() {
  const t = useTranslations("feeding");
  const requirement = useTodaysRequirement();
  const costSummary = useFeedCostSummary(7);
  const feedGroups = useFeedGroups();
  const concentrations = useConcentrations();

  const [feedTodayId, setFeedTodayId] = useState<string | null>(null);

  // One active GROUP-targeted TMR per feed group, if any — used to route a group's "Feed Today"
  // click straight to the existing distribution dialog without the user picking a Concentration
  // manually (matches the doc's "generate today's plan, farmer confirms" flow).
  const tmrByGroup = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of concentrations.data ?? []) {
      if (c.kind === "FEED_MIXTURE" && c.target_type === "GROUP" && c.feed_group_id) {
        map.set(c.feed_group_id, c.id);
      }
    }
    return map;
  }, [concentrations.data]);

  const herdRequirement = requirement.data?.requirement ?? null;

  const herdTmr = (concentrations.data ?? []).find((c) => c.kind === "FEED_MIXTURE" && c.target_type === "HERD");

  const isLoading = requirement.isLoading || costSummary.isLoading || feedGroups.isLoading;
  const isError = requirement.isError || costSummary.isError || feedGroups.isError;

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
        <ErrorState onRetry={() => { requirement.refetch(); costSummary.refetch(); feedGroups.refetch(); }} />
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

      {!isLoading && !isError ? (
        <>
          {/* RFE-105: what the animals need comes first and is always shown — it depends on
              having cows, not on having built a ration. The old card led with the ration and
              told a farm with no TMR to go build one before it would show anything at all. */}
          <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
            <div className="flex flex-col gap-0.5">
              <p className="text-lg font-medium text-foreground">{t("requirementTitle")}</p>
              <p className="text-xs text-muted-foreground">{t("requirementSubtitle")}</p>
            </div>

            {herdRequirement ? (
              <>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  <StatTile
                    label={`${t("perCowLabel")} · ${t("dmLabel")}`}
                    value={t("kgValue", { value: herdRequirement.per_cow.dm_kg.toFixed(1) })}
                  />
                  <StatTile
                    label={`${t("perCowLabel")} · ${t("cpLabel")}`}
                    value={t("kgValue", { value: herdRequirement.per_cow.cp_kg.toFixed(2) })}
                  />
                  <StatTile
                    label={t("herdTotalLabel", { count: herdRequirement.headcount })}
                    value={t("kgValue", { value: herdRequirement.herd_total.dm_kg.toFixed(0) })}
                    sub={t("dmLabel")}
                  />
                  <StatTile
                    label={t("herdTotalLabel", { count: herdRequirement.headcount })}
                    value={t("kgValue", { value: herdRequirement.herd_total.cp_kg.toFixed(1) })}
                    sub={t("cpLabel")}
                  />
                </div>
                {requirement.data?.has_active_ration === false ? (
                  <p className="text-xs text-muted-foreground">{t("noRationYet")}</p>
                ) : null}
              </>
            ) : (
              <EmptyState
                icon={Wheat}
                title={t("noCattle")}
                description={t("noCattleDescription")}
              />
            )}
          </div>

          {(requirement.data?.by_ingredient.length ?? 0) > 0 ? (
            <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
              <p className="text-lg font-medium text-foreground">{t("plannedTitle")}</p>
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {requirement.data!.by_ingredient.map((row) => (
                  <div key={row.ingredient_id} className="flex items-center justify-between p-3">
                    <span className="text-sm text-foreground">{row.name}</span>
                    <span className="text-sm font-semibold text-foreground">
                      {t("kgValue", { value: row.total_kg.toFixed(1) })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <FeedGroupsSection onFeedToday={setFeedTodayId} />
        </>
      ) : null}

      <LogDistributionDialog concentrationId={feedTodayId} onOpenChange={(open) => !open && setFeedTodayId(null)} />
    </div>
  );
}
