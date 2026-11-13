"use client"; // filters + pagination state

import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { parseAsString, useQueryState } from "nuqs";
import { History, Search } from "lucide-react";
import { Input } from "@rakhal/ui/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DatePicker } from "@/components/ui/date-picker";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useActivityInfiniteList } from "../hooks/use-activity";
import { MODULE_STYLE } from "../module-style";
import type { ActivityLogEntry, ActivityModule } from "../types";
import { ActivityCard } from "./activity-card";

const MODULES = Object.keys(MODULE_STYLE) as ActivityModule[];

function groupByDate(items: ActivityLogEntry[]): { dateGroup: string; entries: ActivityLogEntry[] }[] {
  const groups: { dateGroup: string; entries: ActivityLogEntry[] }[] = [];
  for (const entry of items) {
    const last = groups[groups.length - 1];
    if (last && last.dateGroup === entry.dateGroup) {
      last.entries.push(entry);
    } else {
      groups.push({ dateGroup: entry.dateGroup, entries: [entry] });
    }
  }
  return groups;
}

/**
 * Activity Log page (Figma 734:50995) — real, cursor-backed `GET /activity-log`
 * (`activity.controller.ts`/`activity-log.service.ts`), timeline grouped by day with a module
 * filter + a single-day date filter (both real query params) and numbered pagination, matching
 * this app's established honest-frontier list convention (`InfiniteScrollFooter`/`useMedicineInfiniteList`
 * precedent) rather than inventing infinite scroll for a design that shows no pager at all. The
 * mock's "Search activity" box has **no backing endpoint** (`ListActivityQueryDto` has no `search`
 * field) — kept real by filtering the currently-loaded page client-side instead of faking a server
 * search, flagged here rather than silently wired to nothing.
 */
export function ActivityView() {
  const t = useTranslations("activity");
  const locale = useLocale() as Locale;

  const [moduleFilter, setModuleFilter] = useQueryState("module", parseAsString);
  const [dateFilter, setDateFilter] = useQueryState("date", parseAsString);
  const [search, setSearch] = useState("");

  const filters = useMemo(
    () => ({
      module: (moduleFilter as ActivityModule) || undefined,
      from: dateFilter ? `${dateFilter}T00:00:00.000Z` : undefined,
      to: dateFilter ? `${dateFilter}T23:59:59.999Z` : undefined,
    }),
    [moduleFilter, dateFilter],
  );

  const query = useActivityInfiniteList(filters);

  const visibleItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return query.items;
    return query.items.filter(
      (item) => item.eventTitle.toLowerCase().includes(q) || item.actionDetails.toLowerCase().includes(q),
    );
  }, [query.items, search]);

  const groups = useMemo(() => groupByDate(visibleItems), [visibleItems]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-[260px] shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("searchPlaceholder")}
            className="pl-9"
            aria-label={t("searchPlaceholder")}
          />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={moduleFilter ?? "all"}
            onValueChange={(v) => void setModuleFilter(v === "all" ? null : v)}
          >
            <SelectTrigger className="w-[180px]" aria-label={t("moduleFilter")}>
              <SelectValue placeholder={t("moduleFilter")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("allModules")}</SelectItem>
              {MODULES.map((m) => (
                <SelectItem key={m} value={m}>
                  {t(`modules.${m}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DatePicker
            label={t("dateFilter")}
            value={dateFilter ?? undefined}
            onChange={(v) => void setDateFilter(v)}
            placeholder={t("allDates")}
            disabledDates={{ after: new Date() }}
          />
        </div>
      </div>

      {query.isError ? (
        <ErrorState title={t("error.title")} onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <div className="flex flex-col gap-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="h-[178px] animate-pulse rounded-2xl bg-muted" />
          ))}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState icon={History} title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((group) => (
            <div key={group.dateGroup} className="flex flex-col gap-4">
              <div className="flex items-center gap-4">
                <p className="shrink-0 text-xs font-bold text-foreground">{formatDate(group.dateGroup, locale)}</p>
                <div className="h-px flex-1 bg-border" />
              </div>
              <div className="flex flex-col gap-4">
                {group.entries.map((entry) => (
                  <ActivityCard key={entry.id} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {!query.isLoading && !query.isError && query.items.length > 0 ? (
        <InfiniteScrollFooter
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          isError={query.isNextPageError}
          onLoadMore={query.fetchNextPage}
          loadedCount={query.items.length}
        />
      ) : null}
    </div>
  );
}
