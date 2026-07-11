"use client"; // live query

import { useTranslations } from "next-intl";
import { Award, Droplets, HeartPulse, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useCattleHighlights } from "../hooks/use-cattle";

function ChangeBadge({ pct }: { pct: number | null }) {
  if (pct == null) return null;
  const positive = pct >= 0;
  return (
    <span className={`text-xs font-medium ${positive ? "text-success" : "text-destructive"}`}>
      {positive ? "+" : ""}
      {pct}%
    </span>
  );
}

function HighlightTile({
  icon,
  iconBg,
  label,
  value,
  changePct,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: React.ReactNode;
  changePct?: number | null;
}) {
  return (
    <Card className="flex flex-1 flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        <span className={`flex size-7 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>{icon}</span>
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
      </div>
      <div className="flex items-baseline gap-2">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {changePct !== undefined ? <ChangeBadge pct={changePct} /> : null}
      </div>
    </Card>
  );
}

/** 4-tile highlights bar for `GET /cattle/highlights` (PRD §8.2). */
export function CattleHighlightsBar() {
  const t = useTranslations("cattle.highlights");
  const query = useCattleHighlights();

  if (query.isLoading) return <CardSkeleton lines={4} className="rounded-2xl" />;
  if (query.isError) {
    return <ErrorState description={t("error")} onRetry={() => query.refetch()} />;
  }
  const data = query.data;
  if (!data) return null;

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <HighlightTile
        icon={<Users className="size-4 text-info" aria-hidden />}
        iconBg="bg-info-tint"
        label={t("totalActive")}
        value={data.total_active}
        changePct={data.total_change_pct}
      />
      <HighlightTile
        icon={<Award className="size-4 text-warning" aria-hidden />}
        iconBg="bg-warning-tint"
        label={t("avgHerdAqr")}
        value={data.avg_herd_aqr}
        changePct={data.aqr_change_pct}
      />
      <HighlightTile
        icon={<HeartPulse className="size-4 text-destructive" aria-hidden />}
        iconBg="bg-destructive-tint"
        label={t("breedingReady")}
        value={data.breeding_ready_count}
      />
      <HighlightTile
        icon={<Droplets className="size-4 text-success" aria-hidden />}
        iconBg="bg-success-tint"
        label={t("todaysYield")}
        value={`${data.todays_yield_l} L`}
        changePct={data.yield_change_pct}
      />
    </div>
  );
}
