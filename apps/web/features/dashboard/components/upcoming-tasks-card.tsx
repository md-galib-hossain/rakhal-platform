"use client"; // live query

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { useUpcomingTasks } from "../hooks/use-dashboard-widgets";
import { TruncatedText } from "@/components/shared/truncated-text";
import { DashboardCard } from "./dashboard-card";

export function UpcomingTasksCard() {
  const t = useTranslations("dashboard.upcomingTasks");
  const query = useUpcomingTasks();

  const headerRight = (
    <Link
      href="/tasks"
      aria-label={t("viewAllAria")}
      className="text-xs font-medium text-primary-hover hover:underline"
    >
      {t("viewAll")}
    </Link>
  );

  if (query.isLoading) return <CardSkeleton lines={4} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")} headerRight={headerRight}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }
  const data = query.data;
  if (!data) return null;

  return (
    <DashboardCard title={t("title")} headerRight={headerRight}>
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center gap-4 text-sm">
          <span className="text-muted-foreground">
            {t("completed", { done: data.completedToday, total: data.totalToday })}
          </span>
          {data.overdue > 0 ? <Badge variant="destructive">{t("overdue", { count: data.overdue })}</Badge> : null}
        </div>
        {data.tasks.length === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {data.tasks.slice(0, 6).map((task) => (
              <li key={task.id} className="flex items-center justify-between gap-3 text-sm">
                <TruncatedText className="text-foreground">{task.name}</TruncatedText>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <DateText date={task.dueAt} options={{ hour: "numeric", minute: "2-digit" }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </DashboardCard>
  );
}
