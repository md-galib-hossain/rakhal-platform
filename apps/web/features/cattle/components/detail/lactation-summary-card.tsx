"use client"; // live queries

import { useTranslations } from "next-intl";
import { Droplet } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { StatCard } from "@/components/shared/stat-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { useLactationCompare } from "@/features/reproduction/hooks/use-lactation-compare";
import { useLactationStats } from "@/features/reproduction/hooks/use-lactation-stats";
import { useMilkEligibility } from "@/features/milk/hooks/use-milk";
import type { MilkEligibilityStatus } from "@/features/milk/types";
import type { LactationStage } from "../../types";

const MILK_ELIGIBILITY_VARIANT: Record<MilkEligibilityStatus, "primary" | "destructive" | "info" | "warning"> = {
  SALEABLE: "primary",
  WITHHELD: "destructive",
  COLOSTRUM: "info",
  DISCARD_REQUIRED: "warning",
};

/** Stages `deriveLactationStage` (`reproduction/domain/lactation-stage.ts`) only ever returns while
 * the cow has an ACTIVE lactation to fetch stats for — `DRY_PERIOD` and `null` (no lactation
 * history at all) both mean `LactationController.getStats`'s underlying `getCurrentLactationOrThrow`
 * would 404, so those two are gated off before any fetch fires. */
const LACTATING_STAGES: ReadonlySet<LactationStage> = new Set(["FRESH", "EARLY", "MID", "LATE"]);

/**
 * RAKHAL-291-F — Lactation Summary card for the Reproduction tab (RAKHAL-283/284 backend). Resolves
 * the cow's current lactation via `useLactationCompare` (already built for RAKHAL-292-F's curve
 * chart, `current.lactationId`/`current.dim`) rather than adding a second "find the active
 * lactation" query, then loads `GET /reproduction/lactations/:id/stats` for the rest.
 */
export function LactationSummaryCard({
  cattleId,
  lactationStage,
}: {
  cattleId: string;
  lactationStage: LactationStage | null | undefined;
}) {
  const t = useTranslations("cattle.detail.lactation");
  const tStage = useTranslations("cattle.detail");
  const isLactating = Boolean(lactationStage && LACTATING_STAGES.has(lactationStage));

  const compare = useLactationCompare(isLactating ? cattleId : undefined);
  const lactationId = compare.data?.current.lactationId;
  const dim = compare.data?.current.dim;
  const stats = useLactationStats(lactationId);
  const eligibility = useMilkEligibility(cattleId);

  if (!isLactating) {
    return (
      <Card className="rounded-xl p-4">
        <h3 className="mb-3 text-sm font-semibold text-foreground">{t("title")}</h3>
        <EmptyState
          icon={Droplet}
          title={t("notLactating")}
          description={
            lactationStage === "DRY_PERIOD" ? t("dryDescription") : t("noLactationDescription")
          }
          className="py-8"
        />
      </Card>
    );
  }

  if (compare.isLoading || stats.isLoading) {
    return <CardSkeleton lines={4} />;
  }
  if (compare.isError) {
    return <ErrorState description={t("error")} onRetry={() => compare.refetch()} className="py-8" />;
  }
  if (stats.isError) {
    return <ErrorState description={t("error")} onRetry={() => stats.refetch()} className="py-8" />;
  }
  const data = stats.data;
  if (!data) return null;

  const { lactationToDate, peak, persistency } = data;

  return (
    <Card className="flex flex-col gap-4 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        <div className="flex items-center gap-2">
          {lactationStage ? (
            <Chip variant="primary">{tStage(`lactationStageOptions.${lactationStage}`)}</Chip>
          ) : null}
          {eligibility.data ? (
            <span
              title={
                eligibility.data.reasons.length > 0
                  ? eligibility.data.reasons.map((r) => tStage(`milkRestrictionReasonOptions.${r}`)).join(", ")
                  : undefined
              }
            >
              <Chip variant={MILK_ELIGIBILITY_VARIANT[eligibility.data.primaryStatus]}>
                {tStage(`milkEligibilityOptions.${eligibility.data.primaryStatus}`)}
              </Chip>
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,120px),1fr))] gap-4">
        <StatCard label={t("dim")} value={dim != null ? t("days", { value: dim }) : "—"} />
        <StatCard label={t("today")} value={t("litres", { value: data.today })} />
        <StatCard label={t("sevenDayAvg")} value={t("litres", { value: data.sevenDayAvgYield })} />
        <StatCard label={t("thirtyDayAvg")} value={t("litres", { value: data.thirtyDayAvgYield })} />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-xs font-medium text-muted-foreground">{t("lactationToDate")}</p>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,120px),1fr))] gap-x-6 gap-y-2">
          <TotalField label={t("produced")} value={t("litres", { value: lactationToDate.produced })} />
          <TotalField label={t("saleable")} value={t("litres", { value: lactationToDate.saleable })} />
          <TotalField label={t("withheld")} value={t("litres", { value: lactationToDate.withheld })} />
          <TotalField label={t("colostrum")} value={t("litres", { value: lactationToDate.colostrum })} />
          <TotalField label={t("calfFeed")} value={t("litres", { value: lactationToDate.calfFeed })} />
          <TotalField label={t("discarded")} value={t("litres", { value: lactationToDate.discarded })} />
          <TotalField label={t("householdUse")} value={t("litres", { value: lactationToDate.householdUse })} />
        </div>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))] gap-4 border-t border-border pt-4">
        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("peak")}</p>
          {peak ? (
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-bold text-foreground">{t("litres", { value: peak.yieldL })}</p>
              <p className="text-xs text-muted-foreground">
                {t("peakDetail", { dim: peak.dim })} · <DateText date={peak.date} />
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noPeakYet")}</p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <p className="text-xs font-medium text-muted-foreground">{t("persistency")}</p>
          {persistency ? (
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-bold text-foreground">{t("persistencyPct", { value: persistency.persistencyPct })}</p>
              {/* Never an unexplained number — show the two inputs the percentage is derived from. */}
              <p className="text-xs text-muted-foreground">
                {t("persistencyDetail", {
                  current: persistency.currentSevenDayAvgYield,
                  peak: persistency.peakMilkYield,
                  daysSincePeak: persistency.daysSincePeak,
                })}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noPeakYet")}</p>
          )}
        </div>
      </div>
    </Card>
  );
}

function TotalField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-bold text-foreground">{value}</p>
    </div>
  );
}
