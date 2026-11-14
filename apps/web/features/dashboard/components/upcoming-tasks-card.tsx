"use client"; // live query

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Badge } from "@rakhal/ui/ui/badge";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { TruncatedText } from "@rakhal/ui/shared/truncated-text";
import { useUpcomingTasks } from "../hooks/use-dashboard-widgets";
import type { UpcomingTaskItem } from "../types";
import { DashboardCard } from "./dashboard-card";

const MAX_ROWS = 6;

function priorityDot(priority: string): string {
  const p = priority.toLowerCase();
  if (p === "urgent" || p === "high") return "bg-destructive";
  if (p === "medium") return "bg-warning";
  return "bg-muted-foreground/40";
}

function TaskRow({ task, now }: { task: UpcomingTaskItem; now: number }) {
  const overdue = new Date(task.dueAt).getTime() < now;
  return (
    <li>
      <Link
        href="/tasks"
        className="flex items-center gap-3 rounded-xl px-2 py-2 transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary"
      >
        <span className={cn("size-2 shrink-0 rounded-full", priorityDot(task.priority))} aria-hidden />
        <TruncatedText className="min-w-0 flex-1 text-sm font-medium text-foreground">{task.name}</TruncatedText>
        <span
          className={cn(
            "shrink-0 rounded-md px-2 py-0.5 text-xs tabular-nums",
            overdue ? "bg-destructive/10 font-medium text-destructive" : "bg-muted text-muted-foreground",
          )}
        >
          <DateText date={task.dueAt} options={{ hour: "numeric", minute: "2-digit" }} />
        </span>
      </Link>
    </li>
  );
}

export function UpcomingTasksCard() {
  const t = useTranslations("dashboard.upcomingTasks");
  const query = useUpcomingTasks();
  const [now] = useState(() => Date.now());

  const headerRight = (
    <Link href="/tasks" aria-label={t("viewAllAria")} className="text-xs font-medium text-primary-hover hover:underline">
      {t("viewAll")}
    </Link>
  );

  if (query.isLoading) return <CardSkeleton lines={4} className="h-full min-h-[360px] rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")} headerRight={headerRight} className="min-h-[360px]">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }
  const data = query.data;
  if (!data) return null;

  const pct = data.totalToday > 0 ? Math.round((data.completedToday / data.totalToday) * 100) : 0;

  return (
    <DashboardCard title={t("title")} headerRight={headerRight} className="min-h-[360px]">
      <div className="flex flex-1 flex-col gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">{t("completed", { done: data.completedToday, total: data.totalToday })}</span>
            {data.overdue > 0 ? <Badge variant="destructive">{t("overdue", { count: data.overdue })}</Badge> : null}
          </div>
          <div
            role="progressbar"
            aria-label={t("completed", { done: data.completedToday, total: data.totalToday })}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${pct}%` }} />
          </div>
        </div>
        {data.tasks.length === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <ul className="flex flex-col gap-1">
            {data.tasks.slice(0, MAX_ROWS).map((task) => (
              <TaskRow key={task.id} task={task} now={now} />
            ))}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
