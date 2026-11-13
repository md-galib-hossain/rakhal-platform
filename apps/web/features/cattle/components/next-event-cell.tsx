"use client"; // popover open state drives the lazy per-animal events query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@rakhal/ui/ui/button";
import { Chip } from "@/components/ui/chip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUpcomingEvents } from "../hooks/use-cattle";
import { useOptionalCattleDetailModal } from "../context/cattle-detail-modal-context";
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={t("upcoming.open", { name: cattle.name ?? cattle.tagNumber })}
          className="group inline-flex max-w-full items-center text-left rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <Chip
            variant={text.variant}
            subtle
            className="max-w-[18rem] gap-1.5 px-2.5 py-0.5 cursor-pointer transition-colors group-hover:bg-accent/40 group-hover:border-foreground/30"
          >
            <Icon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{text.label}</span>
            <span className="shrink-0 font-medium opacity-85">
              · {text.due}
            </span>
          </Chip>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-84 sm:w-92 p-0 shadow-lg border-border/80">
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
  const modal = useOptionalCattleDetailModal();
  const count = query.data?.total ?? cattle.upcoming_event_count;

  return (
    <div className="flex flex-col">
      <div className="border-b border-border/70 bg-muted/30 px-3.5 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 flex-col">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("upcoming.title")}
            </span>
            <span className="truncate text-sm font-semibold text-foreground">
              {cattle.name ? `${cattle.name} (${cattle.tagNumber})` : cattle.tagNumber}
            </span>
          </div>
          {count > 1 ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              {count}
            </span>
          ) : null}
        </div>
      </div>
      {query.isLoading ? (
        <p className="px-3.5 py-4 text-sm text-muted-foreground">{t("upcoming.loading")}</p>
      ) : query.isError ? (
        <div className="flex items-center justify-between gap-2 px-3.5 py-3">
          <p className="text-sm text-destructive">{t("upcoming.error")}</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t("upcoming.retry")}
          </Button>
        </div>
      ) : (
        <ul className="flex max-h-72 flex-col divide-y divide-border/50 overflow-y-auto">
          {(query.data?.events ?? []).map((event) => (
            <UpcomingEventRow
              key={`${event.ref.type}:${event.ref.id}:${event.labelKey}`}
              event={event}
              detailed
              onRecord={(key) => {
                onView(cattle);
                modal?.openCattleDetail(cattle.id, { record: key, ref: event.ref.id });
              }}
            />
          ))}
        </ul>
      )}
      <div className="border-t border-border bg-muted/10 p-2">
        <Button variant="outline" size="sm" className="w-full justify-center text-xs font-medium" onClick={() => onView(cattle)}>
          {t("upcoming.viewAnimal")}
        </Button>
      </div>
    </div>
  );
}

