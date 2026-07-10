"use client"; // live query + retry action

import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { usePriorities } from "../hooks/use-dashboard-widgets";
import type { PriorityItem } from "../types";

const PRIORITY_STYLE: Record<PriorityItem["priority"], string> = {
  critical: "border-l-destructive",
  urgent: "border-l-warning",
  important: "border-l-warning",
  operational: "border-l-success",
  routine: "border-l-border",
};

export function PrioritiesPanel() {
  const t = useTranslations("dashboard.priorities");
  const query = usePriorities();

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

  const priorities = query.data?.priorities ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {priorities.length === 0 ? (
          <EmptyState title={t("emptyTitle")} description={t("emptyDescription")} />
        ) : (
          <ul className="flex flex-col gap-2">
            {priorities.map((item, index) => (
              <li key={index}>
                <Link
                  href={item.link}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-md border-l-4 bg-muted/50 px-3 py-2.5 text-sm transition-colors hover:bg-muted",
                    PRIORITY_STYLE[item.priority],
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span aria-hidden>{item.icon}</span>
                    <span className="truncate text-foreground">{item.message}</span>
                  </span>
                  <span className="shrink-0 text-xs font-medium text-primary-hover">{item.actionLabel}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
