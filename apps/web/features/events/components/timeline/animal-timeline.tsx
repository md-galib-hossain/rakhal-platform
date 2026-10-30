"use client"; // filter state + live timeline query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { todayLocalIso, addDaysLocalIso } from "@/lib/local-date";
import { useAnimalTimeline } from "../../hooks/use-animal-timeline";
import { TIMELINE_GROUPS, groupByDay, type TimelineGroup } from "../../timeline-model";
import { TimelineRow } from "./timeline-row";

/**
 * Unified timeline of one animal (RFE-155, 03 §3.2): day groups in event-date order, filter chips (one scrollable row,
 * never wrapping), "Show voided", and Load older. Real route when `GET /cattle/:id/events` answers, merged per-domain
 * fallback otherwise (see `use-animal-timeline.ts`).
 */
export function AnimalTimeline({
  cattleId,
  gender,
  animalCategory,
}: {
  cattleId: string;
  gender: string;
  animalCategory: string;
}) {
  const t = useTranslations("events.timeline");
  const [group, setGroup] = useState<TimelineGroup | null>(null);
  const [includeVoided, setIncludeVoided] = useState(false);
  const timeline = useAnimalTimeline({ cattleId, gender, animalCategory, group, includeVoided });
  const days = groupByDay(timeline.items);
  const today = todayLocalIso();
  const yesterday = addDaysLocalIso(today, -1);

  return (
    <section className="flex flex-col gap-3" aria-labelledby="animal-timeline-heading">
      <h2 id="animal-timeline-heading" className="text-sm font-semibold text-foreground">
        {t("title")}
      </h2>

      <div className="flex flex-col gap-2">
        <div role="group" aria-label={t("filterLabel")} className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {[null, ...TIMELINE_GROUPS].map((key) => (
            <button
              key={key ?? "all"}
              type="button"
              aria-pressed={group === key}
              onClick={() => setGroup(key)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3 text-sm transition-colors",
                group === key
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {t(`filter.${key ?? "all"}`)}
            </button>
          ))}
        </div>
        <label className="flex min-h-9 cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={includeVoided}
            onChange={(event) => setIncludeVoided(event.target.checked)}
            className="size-4 accent-primary"
          />
          {t("showVoided")}
        </label>
      </div>

      {timeline.isLoading ? (
        <CardSkeleton lines={4} />
      ) : timeline.isError ? (
        <ErrorState description={t("error")} onRetry={timeline.refetch} />
      ) : days.length === 0 ? (
        <EmptyState title={group ? t("emptyGroup") : t("empty")} className="py-8" />
      ) : (
        <>
          {days.map((day) => (
            <div key={day.day} className="flex flex-col">
              <h3 className="border-b border-border pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {day.day === today ? t("today") : day.day === yesterday ? t("yesterday") : <DateText date={day.events[0].eventAt} />}
              </h3>
              <ol className="divide-y divide-border">
                {day.events.map((event) => (
                  <TimelineRow key={event.id} event={event} />
                ))}
              </ol>
            </div>
          ))}
          {timeline.isNextPageError ? (
            <p className="text-sm text-destructive">{t("olderError")}</p>
          ) : null}
          {timeline.hasNextPage || timeline.isNextPageError ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 self-start"
              disabled={timeline.isFetchingNextPage}
              onClick={timeline.fetchNextPage}
            >
              {timeline.isFetchingNextPage ? t("loadingOlder") : timeline.isNextPageError ? t("retry") : t("loadOlder")}
            </Button>
          ) : null}
          {timeline.source === "fallback" ? <p className="text-xs text-muted-foreground">{t("fallbackNote")}</p> : null}
        </>
      )}
    </section>
  );
}
