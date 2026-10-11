"use client"; // filters + create/details sheet state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { useTaskInfiniteList } from "@/features/tasks/hooks/use-tasks";
import { TaskCard } from "@/features/tasks/components/task-card";
import { CreateTaskSheet } from "@/features/tasks/components/create-task-sheet";
import { TaskDetailsSheet } from "@/features/tasks/components/task-details-sheet";
import { TaskFilterTabs } from "@/features/tasks/components/task-filter-tabs";
import type { Task, TaskHighlights, TaskListFilter } from "@/features/tasks/types";

/** Badge counts on `TaskFilterTabs` come from `meta.highlights`, which is farm-wide — not scoped to
 * this animal. Pass zeros here so the tabs don't show a misleading farm-wide overdue/blocked count. */
const NO_BADGES: TaskHighlights = { dueToday: 0, overdue: 0, blocked: 0, lateCompletionRatePct: 0 };

/**
 * Tasks tab (unified animal-profile redesign, no ticket #) — every `animalCategory`, including
 * `CALF`, gets the same live Task Hub view scoped to this animal (`GET /tasks?cattleId=`, backend
 * companion change). Replaces the calf module's old read-only `CalfTasksTab` (sourced from
 * `CalfDetail.upcomingTasks`, no create action) with the real Task Hub card/create/details flow,
 * reusing `TaskCard`/`CreateTaskSheet`/`TaskDetailsSheet`/`TaskFilterTabs`/`Pagination` as-is — same
 * components `TasksView` (the global Task Hub page) uses, just pre-scoped to one animal and
 * pre-filling `CreateTaskDto.relatedCattleId` on create. Filter tabs + pager keep this readable at
 * any task count (user flagged 200-completed-tasks case, no ticket #) instead of one long unpaged list.
 */
export function TasksTab({ cattleId }: { cattleId: string }) {
  const t = useTranslations("tasks");
  const [filter, setFilter] = useState<TaskListFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);

  const query = useTaskInfiniteList({ cattleId, filter });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <TaskFilterTabs value={filter} onChange={setFilter} highlights={NO_BADGES} />
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="size-[18px]" aria-hidden />
          {t("createTask")}
        </Button>
      </div>

      {query.isError ? (
        <ErrorState title={t("error.title")} onRetry={() => void query.refetch()} />
      ) : query.isLoading ? (
        <CardSkeleton lines={4} />
      ) : query.items.length === 0 ? (
        <EmptyState icon={ClipboardList} title={t("empty.title")} description={t("empty.description")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {query.items.map((task) => (
            <TaskCard key={task.id} task={task} onSeeDetails={setDetailsTask} />
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

      <CreateTaskSheet open={createOpen} onOpenChange={setCreateOpen} defaultCattleId={cattleId} />
      <TaskDetailsSheet task={detailsTask} open={detailsTask !== null} onOpenChange={(open) => !open && setDetailsTask(null)} />
    </div>
  );
}
