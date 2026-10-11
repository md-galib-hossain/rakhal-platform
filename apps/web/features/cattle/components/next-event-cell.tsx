"use client"; // popover open state drives the lazy per-animal events query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpcomingEvents } from "../hooks/use-cattle";
import type { CattleListItem, UpcomingEvent } from "../types";
import { KIND_ICON, UpcomingEventRow, useEventText } from "./upcoming-event-row";

/** RFE-151 — the "Next event" column (MILESTONE 30): the single most urgent upcoming item for the animal as
 * icon + short label + relative date, coloured by urgency only. When more exist a "+N more" hint shows, and the
 * whole cell opens a popover with the full list (fetched on open, never per row up front). The same cell is the
 * phone-card chip in `CattleGrid`. */
export function NextEventCell({
  cattle,
  onView,
}: {
  cattle: CattleListItem;
  onView: (cattle: CattleListItem) => void;
}) {
  if (!cattle.next_event) return <span className="text-muted-foreground">—</span>;
  return <NextEventChip cattle={cattle} event={cattle.next_event} onView={onView} />;
}

function NextEventChip({
  cattle,
  event,
  onView,
}: {
  cattle: CattleListItem;
  event: UpcomingEvent;
  onView: (cattle: CattleListItem) => void;
}) {
  const t = useTranslations("cattle");
  const [open, setOpen] = useState(false);
  const text = useEventText(event);
  const Icon = KIND_ICON[event.kind];
  const more = cattle.upcoming_event_count - 1;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("upcoming.open", { name: cattle.name ?? cattle.tagNumber })}
          className="flex max-w-full items-center gap-1.5 text-left"
        >
          <Chip variant={text.variant} subtle className="max-w-[20rem] gap-1.5 px-2.5">
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{text.label}</span>
            <span className="shrink-0 font-medium opacity-80">
              · {text.due}{text.date ? ` (${text.date})` : ""}
            </span>
          </Chip>
          {more > 0 ? (
            <span className="shrink-0 text-xs font-semibold text-muted-foreground">{t("upcoming.more", { count: more })}</span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <UpcomingEventsList
          cattle={cattle}
          open={open}
          onView={(c) => {
            setOpen(false);
            onView(c);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function UpcomingEventsList({
  cattle,
  open,
  onView,
}: {
  cattle: CattleListItem;
  open: boolean;
  onView: (cattle: CattleListItem) => void;
}) {
  const t = useTranslations("cattle");
  const query = useUpcomingEvents(cattle.id, open);

  return (
    <div className="flex flex-col">
      <p className="border-b border-border px-3 py-2 text-sm font-semibold text-foreground">{t("upcoming.title")}</p>
      {query.isLoading ? (
        <p className="px-3 py-3 text-sm text-muted-foreground">{t("upcoming.loading")}</p>
      ) : query.isError ? (
        <div className="flex items-center justify-between gap-2 px-3 py-3">
          <p className="text-sm text-destructive">{t("upcoming.error")}</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t("upcoming.retry")}
          </Button>
        </div>
      ) : (
        <ul className="flex max-h-72 flex-col overflow-y-auto">
          {(query.data?.events ?? []).map((event) => (
            <UpcomingEventRow key={`${event.ref.type}:${event.ref.id}:${event.labelKey}`} event={event} />
          ))}
        </ul>
      )}
      <div className="border-t border-border p-1.5">
        <Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => onView(cattle)}>
          {t("upcoming.viewAnimal")}
        </Button>
      </div>
    </div>
  );
}

