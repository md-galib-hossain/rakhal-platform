"use client"; // sheet open state + live unread badge

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@rakhal/ui/ui/tooltip";
import { INBOX_PAGE_SIZE } from "@/features/notifications/constants";
import { useNotifications } from "@/features/notifications/hooks/use-notifications";
import {
  closeNotificationSheet,
  openNotificationSheet,
  useNotificationSheetState,
} from "@/features/notifications/sheet-store";

// The sheet (tabs, preferences view) is only fetched the first time the bell is pressed.
const NotificationSheet = dynamic(
  () => import("@/features/notifications/components/notification-sheet").then((m) => m.NotificationSheet),
  { ssr: false },
);

/** RFE-043 bell badge (polls every 60s via `useNotifications`; no push channel exists yet). NV2-F02: pressing
 * it opens the right-side notification sheet (Inbox / Upcoming / New) instead of a popover + `/notifications`. */
export function NotificationBell() {
  const t = useTranslations("topbar");
  // Open state lives in a shared store so other entry points (Settings > Notifications) can open the sheet too.
  const { open } = useNotificationSheetState();
  const [everOpened, setEverOpened] = useState(false);
  const { data } = useNotifications("all", 1, INBOX_PAGE_SIZE);
  const unreadCount = data?.unread_count ?? 0;
  if (open && !everOpened) setEverOpened(true);

  function handleOpenChange(next: boolean) {
    if (next) openNotificationSheet();
    else closeNotificationSheet();
  }

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="icon"
            aria-label={t("notifications")}
            aria-haspopup="dialog"
            aria-expanded={open}
            onClick={() => handleOpenChange(true)}
            className="relative size-10 rounded-full border-border bg-card shadow-xs"
          >
            <Bell className="size-5" />
            {unreadCount > 0 ? (
              <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-medium text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t("notificationsHint")}</TooltipContent>
      </Tooltip>
      {everOpened ? <NotificationSheet open={open} onOpenChange={handleOpenChange} /> : null}
    </>
  );
}
