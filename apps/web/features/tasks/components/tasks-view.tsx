"use client"; // filters + pagination + create/details sheet state

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Plus, Search } from "lucide-react";
import { addDays, startOfDay } from "date-fns";
import { Input } from "@rakhal/ui/ui/input";
import { Button } from "@rakhal/ui/ui/button";
import { Can } from "@/lib/auth/permissions";
import { PageCard } from "@/components/shared/page-card";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { useTaskInfiniteList } from "../hooks/use-tasks";
import { useLastTrusted } from "../hooks/use-last-trusted";
import { listPhase } from "../list-phase";
import type { Task, TaskDateFilter, TaskListFilter, TaskListFilters } from "../types";
import { TaskHighlights } from "./task-highlights";
import { TaskFilterTabs } from "./task-filter-tabs";
import { TaskDateFilterPicker, taskPresetRange } from "./task-date-filter";
import { TaskCard } from "./task-card";
import { CreateTaskSheet } from "./create-task-sheet";
import { TaskDetailsSheet } from "./task-details-sheet";

const LIST_PANEL_ID = "taskhub-list-panel";

/**
 * Card grid sized by the content box (not the viewport — the sidebar eats ~280px): 1 col on phones, 2 from ~672px
 * (laptop), 3 from ~1152px (1536px+ screens), 4 from ~1472px (ultrawide). Cards stretch to equal height per row.
 */
/** Loading placeholder, same footprint as a real card (measured 165px on phones, ~193px at the 2/3-col widths). */
const SKELETON_CARD = "h-[165px] animate-pulse rounded-xl bg-muted @2xl:h-[193px]";

const CARD_GRID = "grid grid-cols-1 gap-3 @2xl:grid-cols-2 @6xl:grid-cols-3 @[92rem]:grid-cols-4";

/**
 * Task Hub — one list over `GET /tasks`: My/All/Overdue/Blocked tabs + highlights. Reminders are no longer tasks
 * (Notifications v2: they live in the bell's notification sheet), so there is no Reminders segment, no `kind` filter
 * sent, and any legacy `REMINDER` row still returned by an older backend is dropped client-side.
 * Sidebar/topbar chrome comes from `AppShell`; the content sits in the shared full-height `PageCard` like every other page.
 * Search matches the task reference or name (`ListTaskQueryDto.search`), debounced 300ms.
 * No client clock: "overdue" is a server filter (`filter=overdue`), so nothing here changes the
 * query key over time and the list never blanks on focus or on a timer.
 */
export function TasksView() {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");

  const [taskTab, setTaskTab] = useState<TaskListFilter>("all");
  const [dateFilter, setDateFilter] = useState<TaskDateFilter>({ id: "all" });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  /** Local-day boundaries, same convention as the backend's `highlights()` `dayStart`/`dayEnd`. */
  const dateRange = useMemo(() => {
    const range = dateFilter.id === "custom" ? dateFilter : taskPresetRange(dateFilter.id);
    if (!range) return {};
    // Picker ranges are inclusive local days; `dueTo` stays the exclusive next-day boundary the old tabs sent.
    return { dueFrom: startOfDay(range.from).toISOString(), dueTo: addDays(startOfDay(range.to), 1).toISOString() };
  }, [dateFilter]);
  const hasRange = dateFilter.id !== "all";

  const filters = useMemo<TaskListFilters>(
    () => ({ filter: taskTab, search: search || undefined, ...dateRange }),
    [taskTab, search, dateRange],
  );
  const query = useTaskInfiniteList(filters);

  // Tolerance for a backend that still has legacy reminder rows (before the cutover migration deletes them).
  const items = useMemo(() => query.items.filter((task) => task.kind !== "REMINDER"), [query.items]);

  const hasFilters = search !== "" || hasRange;
  const clearFilters = () => {
    setDateFilter({ id: "all" });
    setSearchInput("");
    setSearch("");
  };

  // Counts are farm-wide meta of the list response. While loading/failed they are NOT zero, they are unknown:
  // keep the last trusted values (or nothing) instead of flashing fake zeros.
  const countsTrusted = !query.isError && !query.isLoading;
  const highlights = useLastTrusted(query.highlights, countsTrusted);
  const phase = listPhase({ isError: query.isError, isLoading: query.isLoading, itemCount: items.length, isNextPageError: query.isNextPageError });

  const emptyState = hasFilters ? (
    <EmptyState
      icon={ClipboardList}
      title={t("empty.filteredTitle")}
      description={t("empty.filteredDescription")}
      action={
        <Button variant="outline" size="sm" onClick={clearFilters}>
          {t("empty.clear")}
        </Button>
      }
    />
  ) : taskTab === "all" ? (
    <EmptyState icon={ClipboardList} title={t("empty.title")} description={t("empty.description")} />
  ) : (
    <EmptyState icon={ClipboardList} title={t(`empty.byTab.${taskTab}.title`)} description={t(`empty.byTab.${taskTab}.description`)} />
  );

  const createAction = (
    <Can I="task.create">
      <Button className="shrink-0" onClick={() => setCreateOpen(true)}>
        <Plus className="size-[18px]" aria-hidden />
        {t("createTask")}
      </Button>
    </Can>
  );

  return (
    <PageCard title={t("pageTitle")} actions={createAction} className="@container">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <TaskFilterTabs value={taskTab} onChange={setTaskTab} highlights={highlights} panelId={LIST_PANEL_ID} />
          <TaskHighlights
            data={highlights}
            isLoading={query.isLoading}
            dueTodayActive={dateFilter.id === "today"}
            onDueToday={() => {
              setTaskTab("all");
              setDateFilter(dateFilter.id === "today" ? { id: "all" } : { id: "today" });
            }}
          />
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
              aria-label={t("searchPlaceholder")}
            />
          </div>
          <TaskDateFilterPicker value={dateFilter} onChange={setDateFilter} />
          {hasFilters && items.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="self-start sm:self-auto">
              {t("empty.clear")}
            </Button>
          ) : null}
        </div>

        <div role="tabpanel" id={LIST_PANEL_ID} aria-labelledby={`${LIST_PANEL_ID}-tab-${taskTab}`} className="flex flex-col gap-4">
          {phase === "error" ? (
            <ErrorState title={t("error.title")} onRetry={() => void query.refetch()} />
          ) : phase === "loading" ? (
            <div role="status" aria-busy="true" className={CARD_GRID}>
              <span className="sr-only">{tCommon("loading")}</span>
              {Array.from({ length: 8 }, (_, i) => (
                <div key={i} aria-hidden className={SKELETON_CARD} />
              ))}
            </div>
          ) : phase === "empty" ? (
            emptyState
          ) : (
            <div className={CARD_GRID}>
              {items.map((task) => (
                <TaskCard key={task.id} task={task} onSeeDetails={setDetailsTask} />
              ))}
            </div>
          )}

          {phase === "list" ? (
            <InfiniteScrollFooter
              hasNextPage={query.hasNextPage}
              isFetchingNextPage={query.isFetchingNextPage}
              isError={query.isNextPageError}
              onLoadMore={query.fetchNextPage}
              loadedCount={items.length}
            />
          ) : null}
        </div>
      </div>

      <CreateTaskSheet open={createOpen} onOpenChange={setCreateOpen} />
      <TaskDetailsSheet task={detailsTask} open={detailsTask !== null} onOpenChange={(open) => !open && setDetailsTask(null)} />
    </PageCard>
  );
}
