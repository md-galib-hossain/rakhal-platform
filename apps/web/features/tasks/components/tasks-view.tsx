"use client"; // filters + pagination + create/details sheet state

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Plus, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Pagination } from "@/components/shared/pagination";
import { useTaskPagedList } from "../hooks/use-tasks";
import type { Task, TaskListFilter } from "../types";
import { TaskHighlights } from "./task-highlights";
import { TaskFilterTabs } from "./task-filter-tabs";
import { TaskCard } from "./task-card";
import { CreateTaskSheet } from "./create-task-sheet";
import { TaskDetailsSheet } from "./task-details-sheet";

/**
 * Task Hub (Figma 1039:48285 page / 1039:48550 create modal / 1039:48730 details modal) — real,
 * cursor-backed `GET /tasks` (`task.controller.ts`/`task.service.ts`). Sidebar/topbar chrome comes
 * from `AppShell` (established app-wide), so this owns only the content region: the KPI highlights
 * row, the filter-tab + search + card-grid card, and pagination — matching this app's established
 * honest-frontier numbered-pager convention (`Pagination`/`useActivityPagedList` precedent).
 * "Search task by id" is a **real** backed field (`ListTaskQueryDto.search` matches `reference` OR
 * `name`), unlike Activity Log's client-only search gap — debounced 300ms before hitting the API.
 * The whole content region (title/action row + highlights + "All Tasks" card + pagination) sits
 * inside one outer `bg-muted` (Figma "White/white-100" `#F7F7F7`) rounded-2xl page-canvas card
 * (`1039:48338`) — this is the one region of the frame that isn't `AppShell` chrome, so unlike the
 * rest of the page it belongs here rather than in a shared layout component.
 */
export function TasksView() {
  const t = useTranslations("tasks");
  const [filter, setFilter] = useState<TaskListFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const filters = useMemo(() => ({ filter, search: search || undefined }), [filter, search]);
  const query = useTaskPagedList(filters);

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-muted p-4">
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-foreground">{t("pageTitle")}</h1>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="size-[18px]" aria-hidden />
            {t("createTask")}
          </Button>
        </div>

        <TaskHighlights data={query.highlights} isLoading={query.isLoading} />

        <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xl font-medium text-foreground">{t("allTasks")}</p>
            <TaskFilterTabs value={filter} onChange={setFilter} highlights={query.highlights} />
          </div>

          <div className="relative w-full max-w-[300px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
              aria-label={t("searchPlaceholder")}
            />
          </div>

          {query.isError ? (
            <ErrorState title={t("error.title")} onRetry={() => void query.refetch()} />
          ) : query.isLoading ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="h-[300px] animate-pulse rounded-2xl bg-muted" />
              ))}
            </div>
          ) : query.items.length === 0 ? (
            <EmptyState icon={ClipboardList} title={t("empty.title")} description={t("empty.description")} />
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {query.items.map((task) => (
                <TaskCard key={task.id} task={task} onSeeDetails={setDetailsTask} />
              ))}
            </div>
          )}

          {query.totalPages > 1 ? (
            <Pagination page={query.page} totalPages={query.totalPages} onPageChange={query.goToPage} disabled={query.isFetching} />
          ) : null}
        </div>
      </div>

      <CreateTaskSheet open={createOpen} onOpenChange={setCreateOpen} />
      <TaskDetailsSheet task={detailsTask} open={detailsTask !== null} onOpenChange={(open) => !open && setDetailsTask(null)} />
    </div>
  );
}
