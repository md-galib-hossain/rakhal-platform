"use client"; // status filter + load-more state + mark-read mutations

import { useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations, useFormatter } from "next-intl";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { qk } from "@/lib/query/keys";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { notificationsApi } from "../api";
import { INBOX_PAGE_SIZE } from "../constants";
import { useMarkAllNotificationsRead, useMarkNotificationRead } from "../hooks/use-notifications";
import { notificationAction } from "../notification-action";
import type { NotificationListItem, NotificationStatusFilter } from "../types";

/** Same cadence as the bell badge. React Query already pauses the interval while the browser tab is
 * hidden, and this tab only exists while the sheet is open, so nothing polls when nobody can see it. */
const INBOX_POLL_MS = 60_000;

const PRIORITY_VARIANT: Record<NotificationListItem["priority"], "destructive" | "warning" | "info" | "secondary"> = {
  critical: "destructive",
  high: "warning",
  medium: "info",
  low: "secondary",
};

/** NV2-F02 Inbox tab: the list that used to live at `/notifications`. `GET /notifications` is offset-paged
 * (`page`/`per_page`), so "load more" asks for a longer first page instead of stitching pages together. */
export function InboxTab({ onNavigate }: { onNavigate?: () => void }) {
  const t = useTranslations("notificationSheet.inbox");
  const tp = useTranslations("notificationSheet.priority");
  const te = useTranslations("events.notifications");
  const format = useFormatter();
  const locale = useLocale();
  const [status, setStatus] = useState<NotificationStatusFilter>("all");
  const [limit, setLimit] = useState(INBOX_PAGE_SIZE);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    // Prefix stays ["notifications","list",...] so mark-read invalidation reaches this query.
    queryKey: [...qk.notifications.list(status, 1, locale), "inbox", limit],
    queryFn: () => notificationsApi.list(status, 1, limit),
    placeholderData: keepPreviousData,
    refetchInterval: INBOX_POLL_MS,
  });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  function changeStatus(next: NotificationStatusFilter) {
    setStatus(next);
    setLimit(INBOX_PAGE_SIZE);
  }

  const items = data?.notifications ?? [];
  const total = data?.meta.total ?? 0;
  const hasMore = items.length < total;
  const loadingMore = isFetching && !isLoading && hasMore;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-lg bg-muted p-1" role="group" aria-label={t("filterLabel")}>
          {(["all", "unread"] as const).map((key) => (
            <button
              key={key}
              type="button"
              aria-pressed={status === key}
              onClick={() => changeStatus(key)}
              className={cn(
                "min-h-8 rounded-md px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                status === key ? "bg-card text-primary shadow-xs" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`filters.${key}`)}
            </button>
          ))}
        </div>
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
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : isError ? (
        <ErrorState title={t("errorTitle")} description={t("loadError")} onRetry={() => refetch()} className="py-10" />
      ) : items.length === 0 ? (
        <EmptyState
          title={status === "unread" ? t("emptyUnread") : t("empty")}
          description={t("emptyDescription")}
          className="py-10"
        />
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card">
          {items.map((n) => {
            const action = notificationAction(n.link);
            const actionLabel =
              action.kind === "record" ? te("record") : action.kind === "list" ? te("viewAnimals") : null;
            const row = (
              <div
                className={cn(
                  "flex items-start gap-3 px-3 py-3",
                  action.kind !== "none" && "hover:bg-muted/50",
                  !n.read && "bg-primary/5",
                )}
              >
                <Badge variant={PRIORITY_VARIANT[n.priority]} className="mt-0.5 shrink-0">
                  {tp(n.priority)}
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
                {!n.read ? (
                  <>
                    <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" aria-hidden />
                    <span className="sr-only">{t("unread")}</span>
                  </>
                ) : null}
              </div>
            );
            return (
              <li key={n.id}>
                {action.kind !== "none" ? (
                  <Link
                    href={action.href}
                    onClick={() => {
                      if (!n.read) markRead.mutate(n.id);
                      onNavigate?.(); // the sheet is modal: close it so the destination page is usable
                    }}
                    className="block"
                  >
                    {row}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="block w-full cursor-default text-left"
                    onClick={() => !n.read && markRead.mutate(n.id)}
                  >
                    {row}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {hasMore && !isError ? (
        <div className="flex flex-col items-center gap-1">
          <Button variant="outline" size="sm" disabled={loadingMore} onClick={() => setLimit((l) => l + INBOX_PAGE_SIZE)}>
            {loadingMore ? <Loader2 className="size-3.5 animate-spin" /> : null}
            {t("loadMore")}
          </Button>
          <p className="text-xs text-muted-foreground">{t("shown", { shown: items.length, total })}</p>
        </div>
      ) : null}
    </div>
  );
}
