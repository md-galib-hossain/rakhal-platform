"use client"; // popover + live query state

import Link from "next/link";
import { useTranslations, useFormatter } from "next-intl";
import { Bell, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useMounted } from "@/lib/hooks/use-mounted";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotifications,
} from "@/features/notifications/hooks/use-notifications";
import type { NotificationListItem } from "@/features/notifications/types";
import { TruncatedText } from "@/components/shared/truncated-text";

const PRIORITY_DOT: Record<NotificationListItem["priority"], string> = {
  critical: "bg-destructive",
  high: "bg-warning",
  medium: "bg-info",
  low: "bg-muted-foreground",
};

/** RFE-043 — real bell feed replacing the RFE-005 placeholder. Polls every 60s (own AC) via
 * `useNotifications`'s `refetchInterval`; no WebSocket/SSE channel exists for push updates yet. */
export function NotificationBell() {
  const t = useTranslations("topbar");
  const format = useFormatter();
  const mounted = useMounted();
  const { data, isLoading } = useNotifications("all", 1, 10);
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const unreadCount = data?.unread_count ?? 0;
  const items = data?.notifications ?? [];

  return (
    <Popover>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label={t("notifications")}
              className="relative size-10 rounded-full border-border bg-card shadow-xs"
            >
              <Bell className="size-5" />
              {unreadCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("notificationsHint")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="text-sm font-medium text-foreground">{t("notifications")}</p>
          {unreadCount > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-auto gap-1 px-2 py-1 text-xs"
              disabled={markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              {markAllRead.isPending ? <Loader2 className="size-3 animate-spin" /> : <Check className="size-3" />}
              {t("markAllRead")}
            </Button>
          ) : null}
        </div>

        <div className="max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <EmptyState title={t("notifications")} description={t("noNotifications")} className="py-8" />
          ) : (
            <ul>
              {items.map((n) => {
                const row = (
                  <div
                    className={cn(
                      "flex gap-3 border-b border-border px-4 py-3 last:border-b-0 hover:bg-muted/50",
                      !n.read && "bg-primary/5",
                    )}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", PRIORITY_DOT[n.priority])} aria-hidden />
                    <div className="min-w-0 flex-1">
                      <TruncatedText lines={2} className={cn("text-sm text-foreground", !n.read && "font-medium")}>{n.title}</TruncatedText>
                      <TruncatedText lines={2} className="mt-0.5 text-xs text-muted-foreground">{n.message}</TruncatedText>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {mounted ? format.relativeTime(new Date(n.created_at), { now: new Date() }) : null}
                      </p>
                    </div>
                  </div>
                );
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={() => !n.read && markRead.mutate(n.id)}>
                        {row}
                      </Link>
                    ) : (
                      <button
                        type="button"
                        className="block w-full text-left"
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
        </div>

        <div className="flex items-center justify-between border-t border-border px-4 py-2">
          <Link href="/notifications" className="text-xs font-medium text-primary hover:underline">
            {t("viewAll")}
          </Link>
          <Link href="/settings?tab=notifications" className="text-xs font-medium text-primary hover:underline">
            {t("notificationPreferences")}
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
