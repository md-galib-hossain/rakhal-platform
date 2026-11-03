"use client"; // segment + filters + pagination + create/details sheet state

import { useEffect, useMemo, useOptimistic, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { AlarmClock, BellRing, ClipboardList, Plus, Search } from "lucide-react";
import { addDays, startOfDay } from "date-fns";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageCard } from "@/components/shared/page-card";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { useTaskInfiniteList } from "../hooks/use-tasks";
import { useLastTrusted } from "../hooks/use-last-trusted";
import { listPhase, parseView, reminderServerFilters, SEGMENT_PARAM, type ReminderTab, type TaskHubView } from "../reminder-view";
import type { Task, TaskDateFilter, TaskListFilter, TaskListFilters } from "../types";
import { TaskHighlights } from "./task-highlights";
import { TaskFilterTabs } from "./task-filter-tabs";
import { TaskDateFilterPicker, taskPresetRange } from "./task-date-filter";
import { TaskCard } from "./task-card";
import { ReminderCard } from "./reminder-card";
import { ReminderTabs } from "./reminder-tabs";
import { ReminderSheet } from "@/features/events/components/reminders/reminder-sheet";
import { CreateTaskSheet } from "./create-task-sheet";
import { TaskDetailsSheet } from "./task-details-sheet";

const SEGMENT_TAB_PREFIX = "taskhub-segment-tab";
const SEGMENT_PANEL_ID = "taskhub-segment-panel";
const LIST_PANEL_ID = "taskhub-list-panel";

/**
 * Card grid sized by the content box (not the viewport — the sidebar eats ~280px): 1 col on phones, 2 from ~672px
 * (laptop), 3 from ~1152px (1536px+ screens), 4 from ~1472px (ultrawide). Cards stretch to equal height per row.
 */
/** Loading placeholder, same footprint as a real card (measured 165px on phones, ~193px at the 2/3-col widths). */
const SKELETON_CARD = "h-[165px] animate-pulse rounded-xl bg-muted @2xl:h-[193px]";

const CARD_GRID = "grid grid-cols-1 gap-3 @2xl:grid-cols-2 @6xl:grid-cols-3 @[92rem]:grid-cols-4";

/**
 * Task Hub — two segments over one `GET /tasks` table (RAKHAL-491 `kind`): **Tasks** (work to do: My/All/Overdue/
 * Blocked tabs + highlights) and **Reminders** (Upcoming/Overdue/Repeating/Done). The segment lives in the URL
 * (`?segment=reminders`; NOT `?view=`, which the animal workspace overlay owns); search and the date range are shared across segments, the tab of each is its own state.
 * Sidebar/topbar chrome comes from `AppShell`; the content sits in the shared full-height `PageCard` like every other page.
 * Search matches the task reference or name (`ListTaskQueryDto.search`), debounced 300ms.
 * No client clock: "upcoming"/"overdue" are server filters (`filter=upcoming|overdue`), so nothing here changes the
 * query key over time and the list never blanks on focus or on a timer.
 */
export function TasksView() {
  const t = useTranslations("tasks");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlView: TaskHubView = parseView(searchParams.get(SEGMENT_PARAM));
  // The active segment flips on click, not when the URL round-trip lands (reverts to the URL if the nav fails).
  const [view, setOptimisticView] = useOptimistic(urlView);
  const [, startTransition] = useTransition();

  const [taskTab, setTaskTab] = useState<TaskListFilter>("all");
  const [reminderTab, setReminderTab] = useState<ReminderTab>("upcoming");
  const [dateFilter, setDateFilter] = useState<TaskDateFilter>({ id: "all" });
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  function selectView(next: TaskHubView) {
    if (next === view) return;
    startTransition(() => {
      setOptimisticView(next);
      // Keep every other param (e.g. `?view=<cattleId>` for the open animal overlay); only the segment changes.
      const params = new URLSearchParams(searchParams.toString());
      if (next === "reminders") params.set(SEGMENT_PARAM, "reminders");
      else params.delete(SEGMENT_PARAM);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    });
  }

  /** Local-day boundaries, same convention as the backend's `highlights()` `dayStart`/`dayEnd`. */
  const dateRange = useMemo(() => {
    const range = dateFilter.id === "custom" ? dateFilter : taskPresetRange(dateFilter.id);
    if (!range) return {};
    // Picker ranges are inclusive local days; `dueTo` stays the exclusive next-day boundary the old tabs sent.
    return { dueFrom: startOfDay(range.from).toISOString(), dueTo: addDays(startOfDay(range.to), 1).toISOString() };
  }, [dateFilter]);
  const hasRange = dateFilter.id !== "all";

  const filters = useMemo<TaskListFilters>(
    () =>
      view === "reminders"
        ? { ...reminderServerFilters(reminderTab), search: search || undefined, ...dateRange }
        : { kind: "task", filter: taskTab, search: search || undefined, ...dateRange },
    [view, reminderTab, taskTab, search, dateRange],
  );
  const query = useTaskInfiniteList(filters);

  const items = query.items;

  const hasFilters = search !== "" || hasRange;
  const clearFilters = () => {
    setDateFilter({ id: "all" });
    setSearchInput("");
    setSearch("");
  };

  const isReminders = view === "reminders";
  // Counts are farm-wide meta of the list response. While loading/failed they are NOT zero, they are unknown:
  // keep the last trusted values (or nothing) instead of flashing fake zeros.
  const countsTrusted = !query.isError && !query.isLoading;
  const highlights = useLastTrusted(query.highlights, countsTrusted);
  const reminderCounts = useLastTrusted(query.reminderHighlights, countsTrusted);
  const reminderCount = reminderCounts ? reminderCounts.upcoming + reminderCounts.overdue : 0;
  const phase = listPhase({ isError: query.isError, isLoading: query.isLoading, itemCount: items.length, isNextPageError: query.isNextPageError });

  const emptyState = hasFilters ? (
    <EmptyState
      icon={isReminders ? BellRing : ClipboardList}
      title={isReminders ? t("reminders.empty.filteredTitle") : t("empty.filteredTitle")}
      description={isReminders ? t("reminders.empty.filteredDescription") : t("empty.filteredDescription")}
      action={
        <Button variant="outline" size="sm" onClick={clearFilters}>
          {t("empty.clear")}
        </Button>
      }
    />
  ) : isReminders ? (
    <EmptyState icon={BellRing} title={t(`reminders.empty.${reminderTab}.title`)} description={t(`reminders.empty.${reminderTab}.description`)} />
  ) : taskTab === "all" ? (
    <EmptyState icon={ClipboardList} title={t("empty.title")} description={t("empty.description")} />
  ) : (
    <EmptyState icon={ClipboardList} title={t(`empty.byTab.${taskTab}.title`)} description={t(`empty.byTab.${taskTab}.description`)} />
  );

  const createAction = (
    <Can I="task.create">
      {isReminders ? (
        <Button className="shrink-0" onClick={() => setReminderOpen(true)}>
          <AlarmClock className="size-[18px]" aria-hidden />
          {t("newReminder")}
        </Button>
      ) : (
        <Button className="shrink-0" onClick={() => setCreateOpen(true)}>
          <Plus className="size-[18px]" aria-hidden />
          {t("createTask")}
        </Button>
      )}
    </Can>
  );

  const activeSubTab = isReminders ? reminderTab : taskTab;

  return (
    <PageCard title={t("pageTitle")} actions={createAction} className="@container">
      <Tabs value={view} onValueChange={(v) => selectView(v as TaskHubView)} className="w-full">
        <TabsList className="w-full sm:w-fit" aria-label={t("segment.label")}>
          <TabsTrigger value="tasks" id={`${SEGMENT_TAB_PREFIX}-tasks`} aria-controls={SEGMENT_PANEL_ID} className="flex-1 sm:flex-none">
            {t("segment.tasks")}
          </TabsTrigger>
          <TabsTrigger value="reminders" id={`${SEGMENT_TAB_PREFIX}-reminders`} aria-controls={SEGMENT_PANEL_ID} className="flex-1 sm:flex-none">
            {t("segment.reminders")}
            {reminderCount > 0 ? (
              <span className="ml-1.5 min-w-4.5 rounded-full bg-primary/15 px-1 text-center text-[0.7rem] font-bold leading-4 text-primary-text">{reminderCount}</span>
            ) : null}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div role="tabpanel" id={SEGMENT_PANEL_ID} aria-labelledby={`${SEGMENT_TAB_PREFIX}-${view}`} className="flex flex-1 flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
          {isReminders ? (
            <ReminderTabs value={reminderTab} onChange={setReminderTab} counts={reminderCounts} panelId={LIST_PANEL_ID} />
          ) : (
            <TaskFilterTabs value={taskTab} onChange={setTaskTab} highlights={highlights} panelId={LIST_PANEL_ID} />
          )}
          {isReminders ? null : (
            <TaskHighlights
              data={highlights}
              isLoading={query.isLoading}
              dueTodayActive={dateFilter.id === "today"}
              onDueToday={() => {
                setTaskTab("all");
                setDateFilter(dateFilter.id === "today" ? { id: "all" } : { id: "today" });
              }}
            />
          )}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative w-full sm:max-w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={isReminders ? t("reminders.searchPlaceholder") : t("searchPlaceholder")}
              className="pl-9"
              aria-label={isReminders ? t("reminders.searchPlaceholder") : t("searchPlaceholder")}
            />
          </div>
          <TaskDateFilterPicker value={dateFilter} onChange={setDateFilter} />
          {hasFilters && items.length > 0 ? (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="self-start sm:self-auto">
              {t("empty.clear")}
            </Button>
          ) : null}
        </div>

        <div role="tabpanel" id={LIST_PANEL_ID} aria-labelledby={`${LIST_PANEL_ID}-tab-${activeSubTab}`} className="flex flex-col gap-4">
          {phase === "error" ? (
            <ErrorState title={isReminders ? t("reminders.error.title") : t("error.title")} onRetry={() => void query.refetch()} />
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
              {items.map((task) =>
                task.kind === "REMINDER" ? (
                  <ReminderCard key={task.id} task={task} onOpen={setDetailsTask} />
                ) : (
                  <TaskCard key={task.id} task={task} onSeeDetails={setDetailsTask} />
                ),
              )}
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
      <ReminderSheet open={reminderOpen} onOpenChange={setReminderOpen} />
      <TaskDetailsSheet task={detailsTask} open={detailsTask !== null} onOpenChange={(open) => !open && setDetailsTask(null)} />
    </PageCard>
  );
}
