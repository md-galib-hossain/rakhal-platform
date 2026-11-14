"use client"; // live query

import { useTranslations } from "next-intl";
import { DrillBody, DrillCard, DrillStat, DrillStats } from "../workspace/drill/drill-template";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { useCattleReproductionSummary } from "../../hooks/use-cattle-detail-tabs";
import { useReproductionTimeline } from "@/features/events/hooks/use-reproduction-timeline";
import { TimelineRow } from "@/features/events/components/timeline/timeline-row";
import type { AnimalCategory, CattleGender } from "../../types";
import { PregnancyCalvingCard } from "./pregnancy-calving-card"; // RAKHAL-317-F

/** Reproduction tab (Figma B1-S7) — `GET /cattle/:id/reproduction-summary` for the stat cards +
 * `GET /cattle/:id/events?group=REPRODUCTION` (RAKHAL-479) for the chronological reproduction
 * timeline (heat, AI, pregnancy check, calving, abortion, dry off).
 * Female-only on the backend (`getFemaleCattle` 400s for male/castrated) — gated here rather than
 * firing a doomed request. */
export function ReproductionTab({
  cattleId,
  gender,
  animalCategory,
}: {
  cattleId: string;
  gender: CattleGender;
  animalCategory: AnimalCategory;
}) {
  const t = useTranslations("cattle.detail.reproduction");
  const isFemale = gender === "FEMALE";
  const isImmature = animalCategory === "CALF";
  const summary = useCattleReproductionSummary(cattleId, isFemale && !isImmature);
  const timeline = useReproductionTimeline(isFemale && !isImmature ? cattleId : undefined);

  const events = timeline.data?.items ?? [];

  if (isImmature) {
    return (
      <EmptyState
        title={t("notApplicableImmature")}
        description={t("notApplicableImmatureDescription")}
        className="py-16"
      />
    );
  }
  if (!isFemale) {
    return <EmptyState title={t("notApplicable")} description={t("notApplicableDescription")} className="py-16" />;
  }

  if (summary.isLoading) {
    return (
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }
  if (summary.isError) {
    return <ErrorState description={t("error")} onRetry={() => summary.refetch()} />;
  }
  const data = summary.data;
  if (!data) return null;

  return (
    <DrillBody>
      {/* RAKHAL-317-F — calculated-vs-farmer-expected calving date, only renders when pregnant. */}
      <PregnancyCalvingCard cattleId={cattleId} />

      <DrillStats>
        <DrillStat label={t("totalCalvings")} value={data.totalCalvings} />
        <DrillStat
          label={t("calvingInterval")}
          value={data.averageCalvingInterval != null ? t("days", { value: data.averageCalvingInterval }) : "—"}
          muted={data.averageCalvingInterval == null}
        />
        <DrillStat
          label={t("conceptionRate")}
          value={data.conceptionRate != null ? `${Math.round(data.conceptionRate * 100)}%` : "—"}
          muted={data.conceptionRate == null}
        />
      </DrillStats>

      <DrillCard title={t("timeline.title")}>
        {timeline.isLoading ? (
          <CardSkeleton />
        ) : timeline.isError ? (
          <ErrorState description={t("timeline.error")} onRetry={() => timeline.refetch()} />
        ) : events.length === 0 ? (
          <EmptyState title={t("timeline.empty")} className="py-8" />
        ) : (
          <ul className="flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id}>
                <TimelineRow event={event} />
              </li>
            ))}
          </ul>
        )}
      </DrillCard>
    </DrillBody>
  );
}
