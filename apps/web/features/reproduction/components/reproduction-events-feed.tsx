"use client"; // local filter state + live query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Baby, Heart, HeartCrack, Microscope, Syringe } from "lucide-react";
import { CattlePicker, type CattleOption } from "@/components/shared/cattle-picker";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { useReproductionEvents } from "../hooks/use-reproduction";
import type { ReproEventEntry, ReproEventType } from "../types";
import { ReproductionCard } from "./reproduction-card";

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
export function ReproductionEventsFeed() {
  const t = useTranslations("reproduction.eventsFeed");
  const [cattle, setCattle] = useState<CattleOption | null>(null);
  const [eventType, setEventType] = useState<ReproEventType | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const events = useReproductionEvents({
    cattleId: cattle?.id,
    eventType: eventType === "all" ? undefined : eventType,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
    limit: 50,
  });

  const hasActiveFilters = !!cattle || eventType !== "all" || !!fromDate || !!toDate;
  const count = events.data?.items?.length ?? 0;

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
            onValueChange={(_id, option) => setCattle(option)}
            placeholder={t("filterCowPlaceholder")}
          />
        </div>
        <div className="flex min-w-[160px] flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("filterType")}</Label>
          <Select value={eventType} onValueChange={(v) => setEventType(v as ReproEventType | "all")}>
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
          <Input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} aria-label={t("fromDate")} />
        </div>
        <div className="flex min-w-[140px] flex-col gap-1.5">
          <Label className="text-xs text-muted-foreground">{t("toDate")}</Label>
          <Input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} aria-label={t("toDate")} />
        </div>
        {hasActiveFilters ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setCattle(null);
              setEventType("all");
              setFromDate("");
              setToDate("");
            }}
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
        <div className="flex max-h-[480px] flex-col overflow-y-auto pr-1">
          {events.data?.items?.map((event) => (
            <EventRow key={`${event.event_type}-${event.id}`} event={event} />
          ))}
        </div>
      )}
    </ReproductionCard>
  );
}

function EventRow({ event }: { event: ReproEventEntry }) {
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
    </div>
  );
}
