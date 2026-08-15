"use client"; // filters + create/details sheet state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { useTaskPagedList } from "@/features/tasks/hooks/use-tasks";
import { TaskCard } from "@/features/tasks/components/task-card";
import { CreateTaskSheet } from "@/features/tasks/components/create-task-sheet";
import { TaskDetailsSheet } from "@/features/tasks/components/task-details-sheet";
import type { Task } from "@/features/tasks/types";

/**
 * Tasks tab (unified animal-profile redesign, no ticket #) — every `animalCategory`, including
 * `CALF`, gets the same live Task Hub view scoped to this animal (`GET /tasks?cattleId=`, backend
 * companion change). Replaces the calf module's old read-only `CalfTasksTab` (sourced from
 * `CalfDetail.upcomingTasks`, no create action) with the real Task Hub card/create/details flow,
 * reusing `TaskCard`/`CreateTaskSheet`/`TaskDetailsSheet` as-is — same components `TasksView` (the
 * global Task Hub page) uses, just pre-scoped to one animal and pre-filling
 * `CreateTaskDto.relatedCattleId` on create.
 */
export function TasksTab({ cattleId }: { cattleId: string }) {
  const t = useTranslations("tasks");
  const [createOpen, setCreateOpen] = useState(false);
  const [detailsTask, setDetailsTask] = useState<Task | null>(null);

  const query = useTaskPagedList({ cattleId });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
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

      <CreateTaskSheet open={createOpen} onOpenChange={setCreateOpen} defaultCattleId={cattleId} />
      <TaskDetailsSheet task={detailsTask} open={detailsTask !== null} onOpenChange={(open) => !open && setDetailsTask(null)} />
    </div>
  );
}
