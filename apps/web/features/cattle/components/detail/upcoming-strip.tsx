"use client"; // live query + translations

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUpcomingEvents } from "../../hooks/use-cattle";
import { UpcomingEventRow } from "../upcoming-event-row";

/** RFE-152 (MILESTONE 30) — what is coming up for one animal, on the Overview tab: health steps, pregnancy
 * check, expected calving, dry-off, open tasks and withdrawal ends, most urgent first (overdue, then
 * actions, then information). Same endpoint and rows as the Animals list "Next event" popover
 * (`GET /cattle/:id/upcoming-events`), so the two never disagree. Replaces the Overview's old
 * "Next task" block, which showed a single Task Hub task and nothing else. */
export function UpcomingStrip({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle");
  const query = useUpcomingEvents(cattleId, true);
  const events = query.data?.events ?? [];
  const hidden = (query.data?.total ?? 0) - events.length;

  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-foreground">{t("upcoming.title")}</h3>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("upcoming.loading")}</p>
      ) : query.isError ? (
        <div className="flex items-center gap-2">
          <p className="text-sm text-destructive">{t("upcoming.error")}</p>
          <Button variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t("upcoming.retry")}
          </Button>
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("upcoming.none")}</p>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-border">
            {events.map((event) => (
              <UpcomingEventRow key={`${event.ref.type}:${event.ref.id}:${event.labelKey}`} event={event} />
            ))}
          </ul>
          {hidden > 0 ? (
            <p className="border-t border-border px-3 py-2 text-xs font-semibold text-muted-foreground">
              {t("upcoming.more", { count: hidden })}
            </p>
          ) : null}
        </Card>
      )}
    </div>
  );
}
