"use client"; // status filter + pagination + mark-read mutations

import { useState } from "react";
import Link from "next/link";
import { useTranslations, useFormatter } from "next-intl";
import { Check, ChevronLeft, ChevronRight, Loader2, Settings2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "../hooks/use-notifications";
import { notificationAction } from "../notification-action";
import type { NotificationListItem, NotificationStatusFilter } from "../types";

const PER_PAGE = 20;

const PRIORITY_VARIANT: Record<NotificationListItem["priority"], "destructive" | "warning" | "info" | "secondary"> = {
  critical: "destructive",
  high: "warning",
  medium: "info",
  low: "secondary",
};

/** RFE-043 — full notification center at `/notifications` (previously a `RouteStub`). The bell
 * popover shows the latest 10; this page is the real list with status filter + pagination +
 * read/read-all + deep links, matching the ticket's own AC. */
export function NotificationCenterView() {
  const t = useTranslations("notificationsPage");
  const te = useTranslations("events.notifications");
  const format = useFormatter();
  const [status, setStatus] = useState<NotificationStatusFilter>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch, isFetching } = useNotifications(status, page, PER_PAGE);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  function changeStatus(next: NotificationStatusFilter) {
    setStatus(next);
    setPage(1);
  }

  const items = data?.notifications ?? [];
  const total = data?.meta.total ?? 0;
  const hasNext = page * PER_PAGE < total;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {(["all", "unread"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => changeStatus(key)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                status === key ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`filters.${key}`)}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          {data && data.unread_count > 0 ? (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              {markAllRead.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
              {t("markAllRead")}
            </Button>
          ) : null}
          <Button variant="outline" size="sm" className="gap-1.5" asChild>
            <Link href="/settings?tab=notifications">
              <Settings2 className="size-3.5" />
              {t("preferences")}
            </Link>
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState description={t("loadError")} onRetry={() => refetch()} />
      ) : items.length === 0 ? (
        <EmptyState title={t("empty")} description={t("emptyDescription")} />
      ) : (
        <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((n) => {
            const action = notificationAction(n.link);
            const actionLabel =
              action.kind === "record" ? te("record") : action.kind === "list" ? te("viewAnimals") : null;
            const row = (
              <div className={cn("flex items-start gap-3 px-4 py-3 ", action.kind !== "none" && "hover:bg-muted/50", !n.read && "bg-primary/5")}>
                <Badge variant={PRIORITY_VARIANT[n.priority]} className="mt-0.5 shrink-0">
                  {t(`priority.${n.priority}`)}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm text-foreground", !n.read && "font-medium")}>{n.title}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{n.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {format.dateTime(new Date(n.created_at), { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                {actionLabel ? (
                  <span className="mt-0.5 shrink-0 text-xs font-medium text-primary">{actionLabel}</span>
                ) : null}
                {!n.read ? <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden /> : null}
              </div>
            );
            return action.kind !== "none" ? (
              <Link key={n.id} href={action.href} onClick={() => !n.read && markRead.mutate(n.id)}>
                {row}
              </Link>
            ) : (
              <button
                key={n.id}
                type="button"
                className="block w-full cursor-default text-left"
                onClick={() => !n.read && markRead.mutate(n.id)}
              >
                {row}
              </button>
            );
          })}
        </div>
      )}

      {total > PER_PAGE ? (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">{t("pageOf", { page, total: Math.ceil(total / PER_PAGE) })}</p>
          <div className="flex gap-2">
            <Button variant="outline" size="icon" disabled={page <= 1 || isFetching} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-4" />
            </Button>
            <Button variant="outline" size="icon" disabled={!hasNext || isFetching} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
