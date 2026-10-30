"use client"; // live upcoming-events query

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUpcomingEvents } from "@/features/cattle/hooks/use-cattle";
import { KIND_ICON, useEventText } from "@/features/cattle/components/upcoming-event-row";
import type { UpcomingEvent } from "@/features/cattle/types";
import { canSnoozeSkip, recordKeyFor } from "../../next-up-model";
import type { EventKey } from "../../types";
import { SkipControl, SnoozeControl } from "./next-up-actions";

const DUE_TEXT: Record<string, string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  info: "text-info",
  muted: "text-muted-foreground",
};

function NextUpCard({
  event,
  canRecord,
  canEditTask,
  onRecord,
}: {
  event: UpcomingEvent;
  canRecord: boolean;
  canEditTask: boolean;
  onRecord: (key: EventKey, ref: string) => void;
}) {
  const t = useTranslations("events.nextUp");
  const text = useEventText(event);
  const Icon = KIND_ICON[event.kind];
  const recordKey = canRecord ? recordKeyFor(event) : null;
  const taskActions = canEditTask && canSnoozeSkip(event);

  return (
    <Card className="flex w-[85%] shrink-0 snap-start flex-col gap-2 rounded-xl p-3 sm:w-72">
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 size-4 shrink-0", DUE_TEXT[text.variant])} aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold leading-snug text-foreground break-words">{text.label}</span>
          <span className={cn("text-xs font-medium", DUE_TEXT[text.variant])}>
            {text.due}
            {text.date ? <span className="font-normal text-muted-foreground"> ({text.date})</span> : null}
          </span>
        </div>
      </div>
      {!event.actionable ? <p className="text-xs text-muted-foreground">{t("infoOnly")}</p> : null}
      {recordKey || taskActions ? (
        <div className="flex gap-2">
          {recordKey ? (
            <Button type="button" size="sm" className="h-11 flex-1 sm:h-9" onClick={() => onRecord(recordKey, event.ref.id)}>
              {t("record")}
            </Button>
          ) : null}
          {taskActions ? (
            <>
              <SnoozeControl event={event} />
              <SkipControl event={event} />
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/**
 * "Next up" (RFE-160, 03 §3.2): everything due for this animal, most urgent first, as cards with the actions that apply —
 * Record (opens the matching form; the server closes the reminder when the event is saved), Snooze and Skip for Task
 * Hub reminders, nothing for information-only rows. A horizontal snap carousel on phones, a wrapping strip on desktop.
 */
export function NextUp({
  cattleId,
  canRecord,
  onRecord,
}: {
  cattleId: string;
  canRecord: boolean;
  onRecord: (key: EventKey, ref: string) => void;
}) {
  const t = useTranslations("events.nextUp");
  const can = useCan();
  const query = useUpcomingEvents(cattleId, true);
  const events = query.data?.events ?? [];
  const hidden = (query.data?.total ?? 0) - events.length;

  return (
    <section aria-labelledby="next-up-heading" className="flex flex-col gap-2">
      <h2 id="next-up-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("title")}
      </h2>
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
        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
          {events.map((event) => (
            <NextUpCard
              key={`${event.ref.type}:${event.ref.id}:${event.labelKey}`}
              event={event}
              canRecord={canRecord}
              canEditTask={can("task.update")}
              onRecord={onRecord}
            />
          ))}
          {hidden > 0 ? <p className="shrink-0 self-center px-2 text-xs font-semibold text-muted-foreground">{t("more", { count: hidden })}</p> : null}
        </div>
      )}
    </section>
  );
}
