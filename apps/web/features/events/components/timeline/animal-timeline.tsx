"use client"; // filter state + live timeline query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Switch } from "@rakhal/ui/ui/switch";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { DateText } from "@/components/shared/date-text";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { todayLocalIso, addDaysLocalIso } from "@/lib/local-date";
import { useAnimalTimeline } from "../../hooks/use-animal-timeline";
import { TIMELINE_GROUPS, groupByDay, type TimelineGroup } from "../../timeline-model";
import { useRecorderNames } from "./use-recorder-names";
import { RowActions } from "./row-actions/row-actions";
import { TimelineRow } from "./timeline-row";

/**
 * Unified timeline of one animal (RFE-155, 03 §3.2): day groups in event-date order, filter chips (one scrollable row,
 * never wrapping), "Show voided", and Load older, all from `GET /cattle/:id/events`.
 */
export function AnimalTimeline({ cattleId }: { cattleId: string }) {
  const t = useTranslations("events.timeline");
  const [group, setGroup] = useState<TimelineGroup | null>(null);
  const [includeVoided, setIncludeVoided] = useState(false);
  const timeline = useAnimalTimeline({ cattleId, group, includeVoided });
  const recorderName = useRecorderNames();
  const days = groupByDay(timeline.items);
  const today = todayLocalIso();
  const yesterday = addDaysLocalIso(today, -1);

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-border bg-card"
      aria-labelledby="animal-timeline-heading"
    >
      {/* Card header (RFE-187 sticky toolbar): title + Show voided, then the filter chips. Never scrolls away with the list. */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-border p-4 @min-[480px]/ws:px-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="animal-timeline-heading" className="text-base font-semibold text-foreground">
            {t("title")}
          </h2>
          <div className="flex min-h-9 items-center gap-2">
            <label htmlFor="timeline-show-voided" className="cursor-pointer text-sm text-muted-foreground">
              {t("showVoided")}
            </label>
            <Switch id="timeline-show-voided" checked={includeVoided} onCheckedChange={setIncludeVoided} />
          </div>
        </div>
        <div role="group" aria-label={t("filterLabel")} className="-mx-1 flex min-w-0 max-w-full gap-1.5 overflow-x-auto px-1 pb-0.5">
          {[null, ...TIMELINE_GROUPS].map((key) => (
            <button
              key={key ?? "all"}
              type="button"
              aria-pressed={group === key}
              onClick={() => setGroup(key)}
              className={cn(
                "h-9 shrink-0 rounded-full border px-3.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                group === key
                  ? "border-primary bg-primary/10 font-semibold text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {t(`filter.${key ?? "all"}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-2 pb-4 pt-1 @min-[480px]/ws:px-4">
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
                <h3 className="sticky top-0 z-[1] bg-card px-2 pb-1 pt-3 text-xs font-medium tracking-wide text-muted-foreground">
                  {day.day === today ? t("today") : day.day === yesterday ? t("yesterday") : <DateText date={day.events[0].eventAt} />}
                </h3>
                <ol className="flex flex-col gap-0.5">
                  {day.events.map((event) => (
                    <TimelineRow key={event.id} event={event} actorName={recorderName(event.recordedById)} actions={<RowActions cattleId={cattleId} event={event} />} />
                  ))}
                </ol>
              </div>
            ))}
            {timeline.isNextPageError ? <p className="text-sm text-destructive">{t("olderError")}</p> : null}
            {timeline.hasNextPage || timeline.isNextPageError ? (
              <Button type="button" variant="outline" className="h-11 self-start" disabled={timeline.isFetchingNextPage} onClick={timeline.fetchNextPage}>
                {timeline.isFetchingNextPage ? t("loadingOlder") : timeline.isNextPageError ? t("retry") : t("loadOlder")}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
