"use client"; // live upcoming-events query

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BellPlus, BellRing } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUpcomingEvents } from "@/features/cattle/hooks/use-cattle";
import { KIND_ICON, useEventText } from "@/features/cattle/components/upcoming-event-row";
import type { UpcomingEvent } from "@/features/cattle/types";
import type { ComposerAnchor, ComposerAnimal } from "@/features/notifications/schedule-model";
import { openRemindMe } from "@/features/notifications/sheet-store";
import { canSnoozeSkip, recordKeyFor, remindAnchorFor } from "../../next-up-model";
import type { EventKey } from "../../types";
import { SkipControl, SnoozeControl } from "./next-up-actions";
import { orderNextUp } from "./next-up-order";

/** Rows fetched per step; the endpoint caps `limit` at 50, so that is the most the scroll will ever load. */
const PAGE = 10;
const MAX = 50;

const DUE_TEXT: Record<string, string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  info: "text-info",
  muted: "text-muted-foreground",
};

function NextUpCard({
  event,
  animal,
  canRecord,
  canEditTask,
  canRemind,
  onRecord,
}: {
  event: UpcomingEvent;
  animal?: ComposerAnimal;
  canRecord: boolean;
  canEditTask: boolean;
  canRemind: boolean;
  onRecord: (key: EventKey, ref: string) => void;
}) {
  const t = useTranslations("events.nextUp");
  const text = useEventText(event);
  const Icon = KIND_ICON[event.kind];
  const recordKey = canRecord ? recordKeyFor(event) : null;
  const overdue = text.variant === "destructive" || text.variant === "warning";
  const taskActions = canEditTask && canSnoozeSkip(event);
  const anchor: ComposerAnchor | null = canRemind ? remindAnchorFor(event, text.label) : null;

  return (
    <Card
      className={cn("flex w-full shrink-0 flex-col gap-2 rounded-2xl p-3 shadow-none", overdue && "border-warning/40 bg-warning-tint")}
    >
      <div className="flex items-start gap-3">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", overdue ? "bg-warning/15" : "bg-muted")} aria-hidden>
          <Icon className={cn("size-4", DUE_TEXT[text.variant])} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="line-clamp-2 text-sm font-semibold leading-snug text-foreground break-words" title={text.label}>
            {text.label}
          </span>
          <span className={cn("text-xs font-medium", DUE_TEXT[text.variant])}>
            {text.due}
            {text.date ? <span className="font-normal text-muted-foreground"> ({text.date})</span> : null}
          </span>
        </div>
      </div>
      {!event.actionable ? <p className="text-xs text-muted-foreground">{t("infoOnly")}</p> : null}
      {recordKey ? (
        <Button type="button" size="sm" className="h-11 w-full sm:h-9" onClick={() => onRecord(recordKey, event.ref.id)}>
          {t("record")}
        </Button>
      ) : null}
      {taskActions || anchor ? (
        <div className="-ml-1.5 flex items-center">
          {taskActions ? <SnoozeControl event={event} /> : null}
          {taskActions ? <SkipControl event={event} /> : null}
          {anchor ? (
            // Icon-only (name + tooltip from the label) so Snooze and Skip never wrap, even with longer Bangla labels.
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="ml-auto h-11 w-11 px-0 text-muted-foreground hover:text-foreground sm:h-8 sm:w-8"
              aria-label={t("remindMe")}
              title={t("remindMe")}
              onClick={() => openRemindMe({ anchor, animal })}
            >
              <BellRing className="size-4" aria-hidden />
            </Button>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/**
 * "Next up" (RFE-160, 03 §3.2): everything due for this animal, most urgent first, as cards with the actions that apply —
 * Record (opens the matching form; the server closes the task when the event is saved), Snooze and Skip for Task
 * Hub tasks, **Remind me** (opens the notification sheet's New tab anchored to that task / health step), nothing for
 * information-only rows. Overdue first, in one height-capped scroll list that loads more on scroll (no "Show all" click).
 */
export function NextUp({
  cattleId,
  animal,
  canRecord,
  onRecord,
}: {
  cattleId: string;
  /** For "Add reminder": the notice starts on this animal. */
  animal?: ComposerAnimal;
  canRecord: boolean;
  onRecord: (key: EventKey, ref: string) => void;
}) {
  const t = useTranslations("events.nextUp");
  const can = useCan();
  const [limit, setLimit] = useState(PAGE);
  const query = useUpcomingEvents(cattleId, true, limit);
  const loaded = query.data?.events ?? [];
  const events = orderNextUp(loaded);
  const total = Math.max(query.data?.total ?? 0, loaded.length);
  const canLoadMore = total > loaded.length && limit < MAX;
  const canRemind = can("notification.create");
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const busy = query.isFetching;

  // Infinite scroll: the endpoint has no cursor, so each step re-asks for a bigger `limit` (10 → 20 … 50); the previous
  // rows stay on screen meanwhile (keepPreviousData) and nothing is fetched until the user actually scrolls to the end.
  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !canLoadMore || busy || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setLimit((l) => Math.min(l + PAGE, MAX));
      },
      // root: null = the viewport, clipped by whichever ancestor scrolls (the sidebar column when wide, this list when stacked).
      { rootMargin: "0px 0px 160px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [canLoadMore, busy, loaded.length]);

  return (
    <section aria-labelledby="next-up-heading" className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="next-up-heading" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("title")}
        </h2>
        {canRecord && canRemind ? (
          <Button type="button" variant="ghost" size="sm" className="h-11 gap-1 text-primary hover:text-primary sm:h-8" onClick={() => openRemindMe({ animal })}>
            <BellPlus className="size-4" aria-hidden />
            {t("addReminder")}
          </Button>
        ) : null}
      </div>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : query.isError ? (
        <div className="flex items-center gap-2">
          <p className="text-sm text-destructive">{t("error")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("nothingDue")}</p>
      ) : (
        // One bounded, scrollable list (about three cards tall) so it never pushes "At a glance" away; the rest loads as you scroll.
        <div
          ref={scrollRef}
          role="region"
          aria-label={t("title")}
          aria-busy={busy}
          className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto overscroll-contain pb-1 @min-[900px]/ws:max-h-none @min-[900px]/ws:overflow-visible"
        >
          {events.map((event) => (
            <NextUpCard
              key={`${event.ref.type}:${event.ref.id}:${event.labelKey}`}
              event={event}
              animal={animal}
              canRecord={canRecord}
              canEditTask={can("task.update")}
              canRemind={canRemind}
              onRecord={onRecord}
            />
          ))}
          {canLoadMore ? (
            <div ref={sentinelRef} className="py-2 text-center text-xs text-muted-foreground" aria-live="polite">
              {busy ? t("loadingMore") : " "}
            </div>
          ) : total > events.length ? (
            <p className="py-1 text-center text-xs font-medium text-muted-foreground">{t("more", { count: total - events.length })}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
