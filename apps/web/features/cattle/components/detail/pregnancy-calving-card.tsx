"use client"; // live query

import { WS_CARD } from "../workspace/workspace-grid";
import { useTranslations } from "next-intl";
import { Card } from "@rakhal/ui/ui/card";
import { Chip } from "@rakhal/ui/ui/chip";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { DateText } from "@/components/shared/date-text";
import { useActivePregnancy } from "@/features/reproduction/hooks/use-reproduction";

/**
 * RAKHAL-317-F — calculated-vs-expected calving date comparison. `Pregnancy.calculatedCalvingDate`
 * is the system's own conception+280-day estimate, written once at creation and never overwritten
 * by an edit (RAKHAL-317); `expectedCalvingDate` is the farmer-facing date used everywhere else
 * (dashboard forecast, dialogs) and can be manually overridden. Renders nothing when the cow has no
 * ACTIVE pregnancy — supplementary detail, not a primary status indicator (that's already
 * `cattle-profile-card.tsx`'s `pregnantStatus` field).
 */
export function PregnancyCalvingCard({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.pregnancy");
  const pregnancy = useActivePregnancy(cattleId);

  if (pregnancy.isLoading) return <CardSkeleton lines={2} />;
  if (pregnancy.isError) {
    return <ErrorState description={t("error")} onRetry={() => pregnancy.refetch()} className="py-4" />;
  }
  const data = pregnancy.data;
  if (!data || !data.expectedCalvingDate) return null;

  const isManual = data.expectedCalvingDateSource === "MANUAL";
  const datesDiffer =
    isManual && data.calculatedCalvingDate != null && data.calculatedCalvingDate !== data.expectedCalvingDate;

  return (
    <Card className={`${WS_CARD} flex flex-col gap-2`}>
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t("title")}</h3>
        <Chip variant={isManual ? "info" : "primary"}>{t(`source.${data.expectedCalvingDateSource}`)}</Chip>
      </div>
      <DateText date={data.expectedCalvingDate} className="text-lg font-bold text-foreground" />
      {datesDiffer ? (
        <p className="text-xs text-muted-foreground">
          {t("systemEstimate")} <DateText date={data.calculatedCalvingDate as string} className="text-xs" />
        </p>
      ) : null}
    </Card>
  );
}
