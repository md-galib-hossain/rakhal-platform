"use client"; // live queries + dynamic dialog state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Utensils, Wheat } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/shared/stat-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Can } from "@/lib/auth/permissions";
import { useConcentrations, useDmi, useFeedEfficiency, useResolvedRation } from "@/features/feed/hooks/use-feed";
import { LogDistributionDialog } from "@/features/feed/components/log-distribution-dialog";
import { useCalfDetail } from "@/features/calves/hooks/use-calves";
import { ColostrumTab } from "@/features/calves/components/detail/colostrum-tab";
import { MilkFeedingTab } from "@/features/calves/components/detail/milk-feeding-tab";
import { StarterFeedTab } from "@/features/calves/components/detail/starter-feed-tab";
import type { AnimalCategory } from "../../types";

const MATCH_LEVEL_VARIANT: Record<string, "success" | "info" | "secondary"> = {
  INDIVIDUAL: "success",
  HERD: "secondary",
};

/**
 * "Feed Today" (Phase 12.4, 2026-07-18, no Figma frame — new surface; moved here from Performance
 * during the unified animal-profile redesign, no ticket # — feeding content belongs in Feeding) — a
 * cow's own Total Mixed Ration(s) (a `FEED_MIXTURE` targeting exactly this `cattleId`) can be fed
 * directly from her own detail view, without going to the Feed Formulator page. A button per
 * matching TMR (usually one) rather than a full dedicated tab. Also surfaces a minimal efficiency
 * `StatCard` (adherence% + cost/litre) when this cow has any logged feeding history.
 */
function FeedTodayCard({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.performance");
  const concentrations = useConcentrations();
  const efficiency = useFeedEfficiency({ cattleId });
  const [feedTodayId, setFeedTodayId] = useState<string | null>(null);

  const myMixtures = useMemo(
    () =>
      (concentrations.data ?? []).filter((c) => c.kind === "FEED_MIXTURE" && c.cattle_id === cattleId),
    [concentrations.data, cattleId],
  );

  if (concentrations.isLoading || myMixtures.length === 0) return null;

  return (
    <>
      <Card className="flex flex-col gap-3 rounded-xl p-3">
        <p className="text-sm font-medium text-foreground">{t("feedToday")}</p>
        <div className="flex flex-col gap-2">
          {myMixtures.map((c) => (
            <div key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border p-2">
              <p className="truncate text-sm text-foreground">{c.name}</p>
              <Can I="feed.distribution-log">
                <Button variant="secondary" size="sm" className="gap-2" onClick={() => setFeedTodayId(c.id)}>
                  <Utensils className="size-4" aria-hidden />
                  {t("feedToday")}
                </Button>
              </Can>
            </div>
          ))}
        </div>
        {efficiency.data ? (
          <StatCard
            label={t("feedAdherence")}
            value={efficiency.data.adherence_pct != null ? `${efficiency.data.adherence_pct}%` : "—"}
          />
        ) : null}
      </Card>
      <LogDistributionDialog concentrationId={feedTodayId} onOpenChange={(open) => !open && setFeedTodayId(null)} />
    </>
  );
}

function RationDmiSection({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.feeding");
  const ration = useResolvedRation(cattleId);
  const dmi = useDmi(cattleId);

  const isLoading = ration.isLoading || dmi.isLoading;
  const isError = ration.isError || dmi.isError;

  if (isLoading) return <CardSkeleton lines={4} />;
  if (isError) {
    return (
      <ErrorState
        onRetry={() => {
          ration.refetch();
          dmi.refetch();
        }}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Can I="feed.distribution-log">
          <Button variant="secondary" size="sm" asChild>
            <Link href="/feeding">{t("goToFeedingGrid")}</Link>
          </Button>
        </Can>
      </div>

      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold text-foreground">{t("assignedRation")}</p>
        {!ration.data?.concentration ? (
          <EmptyState icon={Wheat} title={t("noRation")} description={t("noRationDescription")} />
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{ration.data.concentration.name}</span>
              <span className="text-xs text-muted-foreground">
                {t("costPerDay", { value: ration.data.concentration.totals.total_cost_tk.toFixed(2) })}
              </span>
            </div>
            {ration.data.match_level ? (
              <Badge variant={MATCH_LEVEL_VARIANT[ration.data.match_level] ?? "secondary"}>
                {t(`matchLevel.${ration.data.match_level}`)}
              </Badge>
            ) : null}
          </div>
        )}
      </Card>

      <Card className="flex flex-col gap-3 p-4">
        <p className="text-sm font-semibold text-foreground">{t("dmiTitle")}</p>
        {dmi.data ? (
          <div className="flex items-center gap-4">
            <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border p-3">
              <span className="text-xs text-muted-foreground">{t("expectedDmi")}</span>
              <p className="text-lg font-semibold text-foreground">{t("kgValue", { value: dmi.data.expected_dmi_kg.toFixed(1) })}</p>
            </div>
            <div className="flex flex-1 flex-col gap-1 rounded-lg border border-border p-3">
              <span className="text-xs text-muted-foreground">{t("actualDmi")}</span>
              <p className="text-lg font-semibold text-foreground">
                {dmi.data.actual_dmi_kg != null ? t("kgValue", { value: dmi.data.actual_dmi_kg.toFixed(1) }) : "—"}
              </p>
              {dmi.data.delta_pct != null ? (
                <span className={dmi.data.delta_pct < -10 || dmi.data.delta_pct > 10 ? "text-xs text-destructive" : "text-xs text-muted-foreground"}>
                  {t("deltaPct", { value: dmi.data.delta_pct.toFixed(1) })}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <EmptyState icon={Wheat} title={t("noDmi")} description={t("noDmiDescription")} />
        )}
      </Card>
    </div>
  );
}

function CalfFeedingSections({ cattleId }: { cattleId: string }) {
  const tCalf = useTranslations("calves.detail.tabs");
  const calfQuery = useCalfDetail(cattleId);

  if (calfQuery.isLoading) return <CardSkeleton lines={4} />;
  if (calfQuery.isError || !calfQuery.data) {
    return <ErrorState onRetry={() => calfQuery.refetch()} />;
  }
  const data = calfQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-foreground">{tCalf("colostrum")}</h3>
        <ColostrumTab calfId={cattleId} data={data} />
      </div>
      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">{tCalf("milk")}</h3>
        <MilkFeedingTab calfId={cattleId} data={data} />
      </div>
      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <h3 className="text-sm font-semibold text-foreground">{tCalf("starterFeed")}</h3>
        <StarterFeedTab calfId={cattleId} data={data} />
      </div>
    </div>
  );
}

/**
 * Cattle-detail Feeding tab (2026-08-13, user request; extended in the unified animal-profile
 * redesign, no ticket #, to branch on `animalCategory`). Non-calf categories keep the resolved
 * active ration (layered targeting — Individual override > Group > Herd default, see
 * `useResolvedRation`), actual-vs-expected dry-matter intake (`useDmi`), and — moved here from
 * Performance — the "Feed Today" TMR shortcut (`FeedTodayCard`). `CALF` rows instead get their
 * calf-rearing feeding sections (Colostrum/Milk & Feeding/Starter Feed), reused as-is from the calf
 * module, stacked as cards under section headings instead of separate top-level tabs.
 */
export function FeedingTab({ cattleId, animalCategory }: { cattleId: string; animalCategory: AnimalCategory }) {
  if (animalCategory === "CALF") {
    return <CalfFeedingSections cattleId={cattleId} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <FeedTodayCard cattleId={cattleId} />
      <RationDmiSection cattleId={cattleId} />
    </div>
  );
}
