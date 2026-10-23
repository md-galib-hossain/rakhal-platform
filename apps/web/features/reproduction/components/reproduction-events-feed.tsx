"use client"; // local filter state + live cursor-paged query

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { endOfDay, format, parseISO, startOfDay } from "date-fns";
import { Baby, Ban, Heart, HeartCrack, Microscope, Pencil, SlidersHorizontal, Syringe, X } from "lucide-react";
import { CattlePicker, type CattleOption } from "@/components/shared/cattle-picker";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { useInfiniteCursorList } from "@/lib/hooks/use-infinite-cursor-list";
import { Can } from "@/lib/auth/permissions";
import { cn } from "@/lib/utils";
import { reproductionApi } from "../api";
import type { ReproEventEntry, ReproEventType } from "../types";
import { AnimalLink } from "@/components/shared/animal-link";
import { ReproductionCard } from "./reproduction-card";
import { BreedingEventDialog } from "./dialogs/breeding-event-dialog";
import { PregnancyDiagnosisDialog } from "./dialogs/pregnancy-diagnosis-dialog";
import { HeatEventEditDialog } from "./dialogs/heat-event-edit-dialog";
import { BreedingEventVoidDialog } from "./dialogs/breeding-event-void-dialog";
import { DatePicker } from "@/components/ui/date-picker";

const EVENT_ICONS: Record<ReproEventType, React.ElementType> = {
  heat: Heart,
  breeding: Syringe,
  pregnancy_diagnosis: Microscope,
  calving: Baby,
  abortion: HeartCrack,
};

const EVENT_TINTS: Record<ReproEventType, string> = {
  heat: "bg-accent-pink-tint text-accent-pink",
  breeding: "bg-info-tint text-info",
  pregnancy_diagnosis: "bg-accent-indigo-tint text-accent-indigo",
  calving: "bg-success-tint text-success",
  abortion: "bg-destructive-tint text-destructive",
};

const EVENT_TYPES: ReproEventType[] = ["heat", "breeding", "pregnancy_diagnosis", "calving", "abortion"];
const MAX_DETAIL_CHIPS = 3;
const EVENTS_PAGE_SIZE = 10;
const DAY_FORMAT = "yyyy-MM-dd";

const dayStartIso = (day: string) => (day ? startOfDay(parseISO(day)).toISOString() : undefined);
const dayEndIso = (day: string) => (day ? endOfDay(parseISO(day)).toISOString() : undefined);

function humanizeDetail(key: string, value: unknown): string | null {
  if (value === false || value == null || value === "") return null;
  const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const display = typeof value === "string" ? value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) : String(value);
  return `${label}: ${display}`;
}

function localDayKey(d: Date): string {
  return format(d, DAY_FORMAT);
}

const cattleName = (c: CattleOption) => c.name ?? c.tagNumber;

function FilterChip({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-xs font-semibold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "border-primary bg-primary text-primary-foreground shadow-xs"
          : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}

/**
 * Reproduction Events Activity Feed.
 * Full width, comprehensive log with filters in a neat top bar.
 */
export function ReproductionEventsFeed() {
  const t = useTranslations("reproduction.eventsFeed");
  const [editingBreedingEventId, setEditingBreedingEventId] = useState<string | null>(null);
  const [editingDiagnosisEvent, setEditingDiagnosisEvent] = useState<ReproEventEntry | null>(null);
  const [editingHeatEvent, setEditingHeatEvent] = useState<ReproEventEntry | null>(null);
  const [voidingBreedingEvent, setVoidingBreedingEvent] = useState<ReproEventEntry | null>(null);
  const [cattle, setCattle] = useState<CattleOption | null>(null);
  const [eventType, setEventType] = useState<ReproEventType | "all">("all");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const filters = {
    cattleId: cattle?.id,
    eventType: eventType === "all" ? undefined : eventType,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  };
  const pager = useInfiniteCursorList(
    ["reproduction", "events", "list", filters],
    (cursor, limit) =>
      reproductionApi.events({
        cattleId: filters.cattleId,
        eventType: filters.eventType,
        fromDate: dayStartIso(fromDate),
        toDate: dayEndIso(toDate),
        cursor,
        limit,
      }),
    { pageSize: EVENTS_PAGE_SIZE, getId: (event) => `${event.event_type}-${event.id}` },
  );

  const hasDateFilter = !!fromDate || !!toDate;
  const panelFilterCount = (cattle ? 1 : 0) + (hasDateFilter ? 1 : 0);
  const hasActiveFilters = panelFilterCount > 0 || eventType !== "all";

  function clearAll() {
    setCattle(null);
    setEventType("all");
    setFromDate("");
    setToDate("");
  }
  function clearDates() {
    setFromDate("");
    setToDate("");
  }

  const dayGroups = useMemo(() => {
    const groups: { day: string; items: ReproEventEntry[] }[] = [];
    for (const item of pager.items) {
      const day = item.event_date.slice(0, 10);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.items.push(item);
      else groups.push({ day, items: [item] });
    }
    return groups;
  }, [pager.items]);

  return (
    <ReproductionCard title={t("title")} description={t("description")}>
      <div className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/40 p-3">
        <div className="flex items-center gap-2">
          <div
            role="group"
            aria-label={t("filterType")}
            className="-mx-1 flex min-w-0 flex-1 gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {(["all", ...EVENT_TYPES] as const).map((value) => {
              const Icon = value === "all" ? null : EVENT_ICONS[value];
              return (
                <FilterChip key={value} active={value === eventType} onClick={() => setEventType(value)}>
                  {Icon ? <Icon className="size-3.5" aria-hidden /> : null}
                  {value === "all" ? t("allTypes") : t(`eventTypes.${value}`)}
                </FilterChip>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 @md:hidden"
            aria-expanded={filtersOpen}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            <SlidersHorizontal aria-hidden />
            {t("filters")}
            {panelFilterCount > 0 ? (
              <span className="min-w-5 rounded-full bg-primary px-1.5 text-center text-xs font-bold leading-5 text-white">
                {panelFilterCount}
              </span>
            ) : null}
          </Button>
        </div>

        <div className={cn("flex-wrap items-end gap-3", filtersOpen ? "flex" : "hidden @md:flex")}>
          <div className="flex w-full min-w-0 flex-col gap-1 @md:w-auto @md:max-w-60 @md:min-w-44 @md:flex-[1.4]">
            <Label className="text-xs font-medium text-muted-foreground">{t("filterCow")}</Label>
            <CattlePicker
              value={cattle?.id}
              onValueChange={(_id, option) => setCattle(option)}
              placeholder={t("filterCowPlaceholder")}
              className="h-9 px-3 text-sm"
            />
          </div>
          <div className="flex min-w-32 flex-1 flex-col gap-1 @md:max-w-44">
            <Label className="text-xs font-medium text-muted-foreground">{t("fromDate")}</Label>
            <DatePicker
              label={t("fromDate")}
              placeholder={t("fromDate")}
              value={fromDate}
              onChange={setFromDate}
              clearable
              className="h-9 px-3"
            />
          </div>
          <div className="flex min-w-32 flex-1 flex-col gap-1 @md:max-w-44">
            <Label className="text-xs font-medium text-muted-foreground">{t("toDate")}</Label>
            <DatePicker
              label={t("toDate")}
              placeholder={t("toDate")}
              value={toDate}
              onChange={setToDate}
              clearable
              className="h-9 px-3"
            />
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-border pt-2.5">
            <span className="text-xs font-medium text-muted-foreground">{t("applied")}</span>
            {eventType !== "all" ? (
              <AppliedChip
                label={t(`eventTypes.${eventType}`)}
                removeLabel={t("removeFilter", { name: t(`eventTypes.${eventType}`) })}
                onRemove={() => setEventType("all")}
              />
            ) : null}
            {cattle ? (
              <AppliedChip
                label={cattleName(cattle)}
                removeLabel={t("removeFilter", { name: cattleName(cattle) })}
                onRemove={() => setCattle(null)}
              />
            ) : null}
            {hasDateFilter ? (
              <AppliedChip
                label={
                  <>
                    {fromDate ? <DateText date={fromDate} /> : t("range.start")} – {toDate ? <DateText date={toDate} /> : t("range.today")}
                  </>
                }
                removeLabel={t("removeFilter", { name: t("range.label") })}
                onRemove={clearDates}
              />
            ) : null}
            <Button variant="ghost" size="sm" className="ml-auto h-7 px-2 text-xs" onClick={clearAll}>
              {t("clearFilters")}
            </Button>
          </div>
        ) : null}
      </div>

      {pager.isLoading ? (
        <div className="flex flex-col gap-3 py-2">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      ) : pager.isError ? (
        <ErrorState description={t("error")} onRetry={() => void pager.refetch()} />
      ) : pager.items.length === 0 ? (
        <EmptyState
          title={t("empty")}
          description={hasActiveFilters ? t("emptyFiltered") : undefined}
          className="py-10"
          action={
            hasActiveFilters ? (
              <Button size="sm" variant="secondary" onClick={clearAll}>
                {t("clearFilters")}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className={cn("flex flex-1 flex-col gap-5", pager.isFetching && "opacity-70 transition-opacity")}>
          {dayGroups.map((group) => (
            <section key={group.day} className="flex flex-col gap-1.5">
              <DayHeading day={group.day} />
              <ul className="flex flex-col divide-y divide-border/60 rounded-xl border border-border/80 bg-card overflow-hidden">
                {group.items.map((event) => (
                  <EventRow
                    key={`${event.event_type}-${event.id}`}
                    event={event}
                    onEdit={
                      event.event_type === "breeding"
                        ? () => setEditingBreedingEventId(event.id)
                        : event.event_type === "pregnancy_diagnosis"
                          ? () => setEditingDiagnosisEvent(event)
                          : event.event_type === "heat"
                            ? () => setEditingHeatEvent(event)
                            : undefined
                    }
                    onVoid={event.event_type === "breeding" ? () => setVoidingBreedingEvent(event) : undefined}
                  />
                ))}
              </ul>
            </section>
          ))}
          <InfiniteScrollFooter
            hasNextPage={pager.hasNextPage}
            isFetchingNextPage={pager.isFetchingNextPage}
            isError={pager.isNextPageError}
            onLoadMore={pager.fetchNextPage}
            loadedCount={pager.items.length}
            className="mt-auto"
          />
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
      <HeatEventEditDialog
        open={editingHeatEvent !== null}
        onOpenChange={(next) => {
          if (!next) setEditingHeatEvent(null);
        }}
        event={editingHeatEvent ?? undefined}
      />
      <BreedingEventVoidDialog
        open={voidingBreedingEvent !== null}
        onOpenChange={(next) => {
          if (!next) setVoidingBreedingEvent(null);
        }}
        event={voidingBreedingEvent ?? undefined}
      />
    </ReproductionCard>
  );
}

function AppliedChip({ label, removeLabel, onRemove }: { label: React.ReactNode; removeLabel: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-primary/10 py-0.5 pl-2.5 pr-1 text-xs font-semibold text-primary">
      <span className="truncate">{label}</span>
      <button
        type="button"
        aria-label={removeLabel}
        onClick={onRemove}
        className="flex size-4.5 items-center justify-center rounded-full transition-colors hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="size-3" aria-hidden />
      </button>
    </span>
  );
}

function DayHeading({ day }: { day: string }) {
  const t = useTranslations("reproduction.eventsFeed");
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  return (
    <h3 className="px-1 text-xs font-bold uppercase tracking-wider text-muted-foreground">
      {day === localDayKey(now) ? (
        t("today")
      ) : day === localDayKey(yesterday) ? (
        t("yesterday")
      ) : (
        <DateText date={day} options={{ weekday: "short", day: "numeric", month: "short", year: "numeric" }} />
      )}
    </h3>
  );
}

function EventRow({ event, onEdit, onVoid }: { event: ReproEventEntry; onEdit?: () => void; onVoid?: () => void }) {
  const t = useTranslations("reproduction.eventsFeed");
  const Icon = EVENT_ICONS[event.event_type];
  const resolution = typeof event.details.resolution === "string" ? event.details.resolution : null;
  const details = Object.entries(event.details)
    .filter(([k]) => k !== "resolution" && k !== "resolved_at")
    .map(([k, v]) => humanizeDetail(k, v))
    .filter((v): v is string => v != null);
  const shownDetails = details.slice(0, MAX_DETAIL_CHIPS);
  const extra = details.length - shownDetails.length;

  return (
    <li className="flex items-center gap-3.5 px-3.5 py-3 transition-colors hover:bg-muted/40">
      <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${EVENT_TINTS[event.event_type]}`}>
        <Icon className="size-4.5" aria-hidden />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="text-sm font-medium text-foreground">
          <span className="font-semibold">{t(`eventTypes.${event.event_type}`)}</span>
          <span className="text-muted-foreground mx-1.5">·</span>
          <AnimalLink
            id={event.cattle_id}
            animalName={event.cattle_name}
            tagNumber={event.cattle_tag}
            className="text-foreground hover:text-primary transition-colors font-medium"
          >
            {event.cattle_name ?? event.cattle_tag}
          </AnimalLink>
          {event.cattle_name ? <span className="ml-1 text-xs text-muted-foreground">({event.cattle_tag})</span> : null}
          {event.event_type === "heat" && resolution ? (
            <span className="ml-2 inline-block rounded-full bg-muted px-2 py-0.5 align-middle text-xs font-semibold text-muted-foreground">
              {t(`resolution.${resolution}`)}
            </span>
          ) : null}
        </p>
        {shownDetails.length > 0 ? (
          <ul className="flex flex-nowrap gap-1.5 overflow-hidden" title={details.join(" · ")}>
            {shownDetails.map((d) => (
              <li key={d} className="min-w-0 shrink truncate rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                {d}
              </li>
            ))}
            {extra > 0 ? (
              <li className="shrink-0 rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                {t("moreDetails", { count: extra })}
              </li>
            ) : null}
          </ul>
        ) : null}
      </div>
      {onEdit || onVoid ? (
        <Can I="reproduction.update">
          <div className="flex shrink-0 items-center gap-1">
            {onEdit ? (
              <Button variant="ghost" size="icon" className="size-8" onClick={onEdit} aria-label={t("edit")}>
                <Pencil className="size-4" aria-hidden />
              </Button>
            ) : null}
            {onVoid ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                onClick={onVoid}
                aria-label={t("void")}
                title={t("void")}
              >
                <Ban className="size-4" aria-hidden />
              </Button>
            ) : null}
          </div>
        </Can>
      ) : null}
    </li>
  );
}
