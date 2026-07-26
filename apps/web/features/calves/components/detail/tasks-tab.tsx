"use client"; // no state — pure presentational

import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { Chip } from "@/components/ui/chip";
import type { CalfDetail } from "../../types";

/** Read-only — no create-task-from-here action, that is Task Hub's job (`features/tasks`). */
export function TasksTab({ data }: { data: CalfDetail }) {
  const t = useTranslations("calves.detail.tasks");

  if (data.upcomingTasks.length === 0) {
    return <EmptyState title={t("empty")} className="py-10" />;
  }

  return (
    <div className="flex flex-col gap-2">
      {data.upcomingTasks.map((task) => (
        <div key={task.id} className="flex items-center justify-between gap-3 rounded-xl border border-border p-3">
          <div className="flex flex-col gap-0.5">
            <p className="text-sm font-medium text-foreground">{task.name}</p>
            <Chip variant="muted" className="w-fit">
              {task.category}
            </Chip>
          </div>
          <DateText date={task.dueAt} className="text-xs text-muted-foreground" />
        </div>
      ))}
    </div>
  );
}
