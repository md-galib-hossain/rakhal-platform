"use client"; // local filter state + live query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Baby, Heart, HeartCrack, Microscope, Pencil, Syringe } from "lucide-react";
import { CattlePicker, type CattleOption } from "@/components/shared/cattle-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Pagination } from "@/components/shared/pagination";
import { PAGE_SIZE_OPTIONS } from "@/lib/hooks/use-cursor-pager";
import { Can } from "@/lib/auth/permissions";
import { useReproductionEvents } from "../hooks/use-reproduction";
import type { ReproEventEntry, ReproEventType } from "../types";
import { ReproductionCard } from "./reproduction-card";
import { BreedingEventDialog } from "./dialogs/breeding-event-dialog";
import { PregnancyDiagnosisDialog } from "./dialogs/pregnancy-diagnosis-dialog";

const EVENT_ICONS: Record<ReproEventType, React.ElementType> = {
  heat: Heart,
  breeding: Syringe,
  pregnancy_diagnosis: Microscope,
  calving: Baby,
  abortion: HeartCrack,
};

/** Distinct tint per event type so the feed scans quickly instead of every row looking identical. */
const EVENT_TINTS: Record<ReproEventType, string> = {
  heat: "bg-accent-pink-tint text-accent-pink",
  breeding: "bg-info-tint text-info",
  pregnancy_diagnosis: "bg-accent-indigo-tint text-accent-indigo",
  calving: "bg-success-tint text-success",
  abortion: "bg-destructive-tint text-destructive",
};

/** `detection_method: VISUAL` → `Detection Method: Visual` — the raw `details` dump from the
 * backend's unified feed is snake_case keys / SCREAMING_CASE enum values; this is purely cosmetic
 * (no i18n translation table for every backend enum value across 5 event types — out of scope).
 * `false`/`null`/empty-string values are dropped: "Standing Heat: No" or "Inseminator: null" on
 * every row that didn't have one added noise without information. */
function humanizeDetail(key: string, value: unknown): string | null {
  if (value === false || value == null || value === "") return null;
  const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const display = typeof value === "string" ? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : String(value);
  return `${label}: ${display}`;
}

/** Unified reproduction events feed (RAKHAL-051 `GET /reproduction/events`) — every heat/AI/pregnancy-
 * check/calving/abortion in one real-time-sortable list, filtered by cow, type, and date range. No
 * Figma frame for this module: filter row built from the same primitives `FilterBar` uses
 * (`CattlePicker`, `Select`, date `Input`s) rather than `FilterBar` itself, since its URL-synced
 * select model doesn't fit a combobox + date-range cleanly — local component state instead. */
/** The backend's `GET /reproduction/events` has no cursor/offset support (it just slices the top
 * `limit` rows server-side, capped at 100 — `ReproEventsQueryDto`) — so pagination here is
 * client-side over one fetch at the cap, same pattern `Pagination`'s own doc comment calls out for
 * the Milk Log table. */
const FETCH_LIMIT = 100;

export function ReproductionEventsFeed() {
  const t = useTranslations("reproduction.eventsFeed");
  const [editingBreedingEventId, setEditingBreedingEventId] = useState<string | null>(null);
  const [editingDiagnosisEvent, setEditingDiagnosisEvent] = useState<ReproEventEntry | null>(null);
  const [cattle, setCattle] = useState<CattleOption | null>(null);
  const [eventType, setEventType] = useState<ReproEventType | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);

  const events = useReproductionEvents({
    cattleId: cattle?.id,
    eventType: eventType === "all" ? undefined : eventType,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    limit: FETCH_LIMIT,
  });

  const hasActiveFilters = !!cattle || eventType !== "all" || !!fromDate || !!toDate;
  const allItems = events.data?.items ?? [];
  const count = allItems.length;
  const totalPages = Math.max(1, Math.ceil(count / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageItems = allItems.slice((safePage - 1) * pageSize, safePage * pageSize);

  function updateFilters(apply: () => void) {
    apply();
    setPage(1);
  }

  return (
    <ReproductionCard
      title={t("title")}
      headerRight={
        !events.isLoading && !events.isError ? (
          <span className="text-xs text-muted-foreground">{t("resultCount", { count })}</span>
        ) : undefined
      }
    >
      <div className="flex flex-wrap items-end gap-3 rounded-xl bg-muted/40 p-3">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("filterCow")}</Label>
          <CattlePicker
            value={cattle?.id}
            onValueChange={(_id, option) => updateFilters(() => setCattle(option))}
            placeholder={t("filterCowPlaceholder")}
          />
        </div>
        <div className="flex min-w-[160px] flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("filterType")}</Label>
          <Select
            value={eventType}
            onValueChange={(v) => updateFilters(() => setEventType(v as ReproEventType | "all"))}
          >
            <SelectTrigger aria-label={t("filterType")}>
              <SelectValue placeholder={t("filterType")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allTypes")}</SelectItem>
              <SelectItem value="heat">{t("eventTypes.heat")}</SelectItem>
              <SelectItem value="breeding">{t("eventTypes.breeding")}</SelectItem>
              <SelectItem value="pregnancy_diagnosis">{t("eventTypes.pregnancy_diagnosis")}</SelectItem>
              <SelectItem value="calving">{t("eventTypes.calving")}</SelectItem>
              <SelectItem value="abortion">{t("eventTypes.abortion")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex min-w-[140px] flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("fromDate")}</Label>
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => updateFilters(() => setFromDate(e.target.value))}
            aria-label={t("fromDate")}
          />
        </div>
        <div className="flex min-w-[140px] flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("toDate")}</Label>
          <Input
            type="date"
            value={toDate}
            onChange={(e) => updateFilters(() => setToDate(e.target.value))}
            aria-label={t("toDate")}
          />
        </div>
        {hasActiveFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              updateFilters(() => {
                setCattle(null);
                setEventType("all");
                setFromDate("");
                setToDate("");
              })
            }
          >
            {t("clearFilters")}
          </Button>
        ) : null}
      </div>

      {events.isLoading ? (
        <CardSkeleton lines={5} />
      ) : events.isError ? (
        <ErrorState description={t("error")} onRetry={() => events.refetch()} />
      ) : count === 0 ? (
        <EmptyState
          title={t("empty")}
          description={hasActiveFilters ? t("emptyFiltered") : undefined}
          className="py-8"
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col">
            {pageItems.map((event) => (
              <EventRow
                key={`${event.event_type}-${event.id}`}
                event={event}
                onEdit={
                  event.event_type === "breeding"
                    ? () => setEditingBreedingEventId(event.id)
                    : event.event_type === "pregnancy_diagnosis"
                      ? () => setEditingDiagnosisEvent(event)
                      : undefined
                }
              />
            ))}
          </div>
          {count > PAGE_SIZE_OPTIONS[0] || totalPages > 1 ? (
            <Pagination
              page={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={(next) => {
                setPageSize(next);
                setPage(1);
              }}
            />
          ) : null}
        </div>
      )}

      <BreedingEventDialog
        open={editingBreedingEventId !== null}
        onOpenChange={(next) => {
          if (!next) setEditingBreedingEventId(null);
        }}
        eventId={editingBreedingEventId ?? undefined}
      />
      <PregnancyDiagnosisDialog
        open={editingDiagnosisEvent !== null}
        onOpenChange={(next) => {
          if (!next) setEditingDiagnosisEvent(null);
        }}
        editingEvent={editingDiagnosisEvent ?? undefined}
      />
    </ReproductionCard>
  );
}

function EventRow({ event, onEdit }: { event: ReproEventEntry; onEdit?: () => void }) {
  const t = useTranslations("reproduction.eventsFeed");
  const Icon = EVENT_ICONS[event.event_type];
  const details = Object.entries(event.details)
    .map(([k, v]) => humanizeDetail(k, v))
    .filter((v): v is string => v != null);

  return (
    <div className="flex items-start gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/50">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${EVENT_TINTS[event.event_type]}`}>
        <Icon className="size-4" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
          <span className="text-sm font-medium text-foreground">
            {t(`eventTypes.${event.event_type}`)} <span className="text-muted-foreground">—</span>{" "}
            {event.cattle_name ?? event.cattle_tag}
          </span>
          <DateText date={event.event_date} className="shrink-0 text-xs text-muted-foreground" />
        </div>
        {details.length > 0 ? (
          <p className="truncate text-xs text-muted-foreground" title={details.join(" · ")}>
            {details.join(" · ")}
          </p>
        ) : null}
      </div>
      {onEdit ? (
        <Can I="reproduction.update">
          <Button variant="ghost" size="icon" className="size-8 shrink-0" onClick={onEdit} aria-label={t("edit")}>
            <Pencil className="size-3.5" aria-hidden />
          </Button>
        </Can>
      ) : null}
    </div>
  );
}
