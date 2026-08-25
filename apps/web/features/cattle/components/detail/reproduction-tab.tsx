"use client"; // live query

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { AlertTriangle, Baby, Heart, Stethoscope, Syringe } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Timeline, type TimelineItem } from "@/components/ui/timeline";
import { useCattleReproductionSummary } from "../../hooks/use-cattle-detail-tabs";
import { useReproductionEvents } from "@/features/reproduction/hooks/use-reproduction";
import type { ReproEventEntry, ReproEventType } from "@/features/reproduction/types";
import type { AnimalCategory, CattleGender } from "../../types";
import { PregnancyCalvingCard } from "./pregnancy-calving-card"; // RAKHAL-317-F

const EVENT_ICON: Record<ReproEventType, React.ReactNode> = {
  heat: <Heart className="size-4" aria-hidden />,
  breeding: <Syringe className="size-4" aria-hidden />,
  pregnancy_diagnosis: <Stethoscope className="size-4" aria-hidden />,
  calving: <Baby className="size-4" aria-hidden />,
  abortion: <AlertTriangle className="size-4" aria-hidden />,
};

const EVENT_TONE: Record<ReproEventType, TimelineItem["tone"]> = {
  heat: "info",
  breeding: "primary",
  pregnancy_diagnosis: "primary",
  calving: "success",
  abortion: "warning",
};

/** Reproduction tab (Figma B1-S7) — `GET /cattle/:id/reproduction-summary` for the stat cards +
 * `GET /reproduction/events?cattleId=` (RAKHAL-363) for a chronological timeline of every heat/
 * AI/pregnancy-check/calving/abortion event. Previously this tab only fetched breeding + calving
 * event tables, silently omitting heat and pregnancy-diagnosis events — a cow whose only activity
 * so far was a heat observation or check (no breeding/calving row yet) showed an empty tab. The
 * unified events feed already merges all five event types, just was never wired here before.
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
  const tBreedingMethod = useTranslations("reproduction.dialogs.breeding.breedingMethodValue");
  const tDiagnosisResult = useTranslations("reproduction.dialogs.pregnancyDiagnosis.resultValue");
  const tHeatMethod = useTranslations("reproduction.dialogs.heat.detectionMethodValue");
  const tCalvingEase = useTranslations("reproduction.dialogs.calving.easeValue");
  const isFemale = gender === "FEMALE";
  const isImmature = animalCategory === "CALF";
  const summary = useCattleReproductionSummary(cattleId, isFemale && !isImmature);
  const timeline = useReproductionEvents({ cattleId: isFemale && !isImmature ? cattleId : undefined, limit: 50 });

  const timelineItems = useMemo<TimelineItem[]>(() => {
    const items = timeline.data?.items ?? [];
    return items.map((event: ReproEventEntry) => ({
      id: event.id,
      icon: EVENT_ICON[event.event_type],
      tone: EVENT_TONE[event.event_type],
      title: t(`timeline.eventTitle.${event.event_type}`),
      date: <DateText date={event.event_date} />,
      subtitle: eventSubtitle(event, { tBreedingMethod, tDiagnosisResult, tHeatMethod, tCalvingEase, t }),
    }));
  }, [timeline.data, t, tBreedingMethod, tDiagnosisResult, tHeatMethod, tCalvingEase]);

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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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
    <div className="flex flex-col gap-4">
      {/* RAKHAL-317-F — calculated-vs-farmer-expected calving date, only renders when pregnant. */}
      <PregnancyCalvingCard cattleId={cattleId} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("totalCalvings")} value={data.totalCalvings} />
        <StatCard
          label={t("calvingInterval")}
          value={data.averageCalvingInterval != null ? t("days", { value: data.averageCalvingInterval }) : "—"}
        />
        <StatCard
          label={t("conceptionRate")}
          value={data.conceptionRate != null ? `${Math.round(data.conceptionRate * 100)}%` : "—"}
        />
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">{t("timeline.title")}</h3>
        {timeline.isLoading ? (
          <CardSkeleton />
        ) : timeline.isError ? (
          <ErrorState description={t("timeline.error")} onRetry={() => timeline.refetch()} />
        ) : timelineItems.length === 0 ? (
          <EmptyState title={t("timeline.empty")} className="py-8" />
        ) : (
          <Timeline items={timelineItems} />
        )}
      </div>
    </div>
  );
}

type SimpleTranslator = (key: string, values?: Record<string, string | number>) => string;

/** Per-event-type subtitle line for a timeline row, built from `ReproEventEntry.details` (the same
 * bespoke snake_case shape `GET /reproduction/events` returns for every event type). */
function eventSubtitle(
  event: ReproEventEntry,
  translators: {
    tBreedingMethod: SimpleTranslator;
    tDiagnosisResult: SimpleTranslator;
    tHeatMethod: SimpleTranslator;
    tCalvingEase: SimpleTranslator;
    t: SimpleTranslator;
  },
): string {
  const { tBreedingMethod, tDiagnosisResult, tHeatMethod, tCalvingEase, t } = translators;
  const d = event.details;
  switch (event.event_type) {
    case "heat":
      return typeof d.detection_method === "string" ? tHeatMethod(d.detection_method) : "";
    case "breeding":
      return [
        typeof d.method === "string" ? tBreedingMethod(d.method) : null,
        typeof d.status === "string" ? t(`breedingStatusValue.${d.status}`) : null,
      ]
        .filter(Boolean)
        .join(" · ");
    case "pregnancy_diagnosis":
      return typeof d.result === "string" ? tDiagnosisResult(d.result) : "";
    case "calving":
      return typeof d.calving_ease === "string" ? tCalvingEase(d.calving_ease) : "";
    case "abortion":
      return typeof d.suspected_cause === "string" ? d.suspected_cause : "";
    default:
      return "";
  }
}
