"use client"; // live query

import { Suspense } from "react";
import { useTranslations } from "next-intl";
import { Award, Droplets, HeartPulse, TrendingDown, TrendingUp, Users } from "lucide-react";
import { Card } from "@rakhal/ui/ui/card";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "@/lib/format";
import { useCattleHighlights } from "../hooks/use-cattle";
import { CattleCategoryHighlights } from "./cattle-category-highlights";

function TrendChip({ pct }: { pct: number }) {
  const positive = pct >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full py-1 pl-1 pr-1.5 text-xs font-bold",
        positive ? "bg-success-tint text-success" : "bg-destructive-tint text-destructive",
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {formatSignedPct(pct)}
    </span>
  );
}

function HighlightTile({
  icon,
  iconBg,
  label,
  value,
  changePct,
  footnote,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  changePct?: number | null;
  footnote?: React.ReactNode;
}) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-3 rounded-xl border border-border bg-card p-3">
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg", iconBg)}>{icon}</span>
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-2xl font-bold tracking-tight text-foreground tabular-nums">{value}</p>
        {changePct != null || footnote ? (
          <div className="flex h-6 items-center gap-2">
            {changePct != null ? <TrendChip pct={changePct} /> : null}
            {footnote ? <p className="text-xs text-muted-foreground">{footnote}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** 4-tile highlights bar for `GET /cattle/highlights` (PRD §8.2) — pixel-matched to the Figma
 * "Cattle Highlights" card: its own elevated section (title + shadowed row of KPI tiles) rather
 * than floating tiles directly on the page. */
export function CattleHighlightsBar() {
  const t = useTranslations("cattle.highlights");
  const query = useCattleHighlights();

  return (
    <Card className="flex flex-col gap-4 rounded-2xl border-border p-4 shadow-card">
      <p className="text-xl font-medium text-foreground">{t("title")}</p>

      {query.isLoading ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[140px] flex-1 rounded-xl" />
          ))}
        </div>
      ) : query.isError ? (
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      ) : query.data ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <HighlightTile
            icon={<Users className="size-4 text-accent-indigo" aria-hidden />}
            iconBg="bg-accent-indigo-tint"
            label={t("totalActive")}
            value={query.data.total_active}
            changePct={query.data.total_change_pct}
            footnote={query.data.total_change_pct != null ? t("vsLastMonth") : undefined}
          />
          <HighlightTile
            icon={<Award className="size-4 text-info" aria-hidden />}
            iconBg="bg-info-tint"
            label={t("avgHerdAqr")}
            value={query.data.avg_herd_aqr}
            changePct={query.data.aqr_change_pct}
            footnote={query.data.aqr_change_pct != null ? t("vsLastMonth") : undefined}
          />
          <HighlightTile
            icon={<HeartPulse className="size-4 text-accent-indigo" aria-hidden />}
            iconBg="bg-accent-indigo-tint"
            label={t("breedingReady")}
            value={query.data.breeding_ready_count}
          />
          <HighlightTile
            icon={<Droplets className="size-4 text-success" aria-hidden />}
            iconBg="bg-success-tint"
            label={t("todaysYield")}
            value={`${query.data.todays_yield_l}L`}
            changePct={query.data.todays_yield_l > 0 ? query.data.yield_change_pct : null}
            footnote={query.data.todays_yield_l > 0 && query.data.yield_change_pct != null ? t("vsYesterday") : undefined}
          />
        </div>
      ) : null}

      <div className="border-t border-border pt-4">
        <Suspense fallback={<Skeleton className="h-[92px] w-full rounded-xl" />}>
          <CattleCategoryHighlights />
        </Suspense>
      </div>
    </Card>
  );
}
