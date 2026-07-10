"use client"; // live query

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { useUpcomingTasks } from "../hooks/use-dashboard-widgets";

export function UpcomingTasksCard() {
  const t = useTranslations("dashboard.upcomingTasks");
  const query = useUpcomingTasks();

  if (query.isLoading) return <CardSkeleton lines={4} />;
  if (query.isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorState description={t("error")} onRetry={() => query.refetch()} />
        </CardContent>
      </Card>
    );
  }
  const data = query.data;
  if (!data) return null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{t("title")}</CardTitle>
        <Link href="/tasks" className="text-xs font-medium text-primary-hover hover:underline">
          {t("viewAll")}
        </Link>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
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
                <span className="min-w-0 truncate text-foreground">{task.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  <DateText date={task.dueAt} options={{ hour: "numeric", minute: "2-digit" }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
