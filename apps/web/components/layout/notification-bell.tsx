"use client";

import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Placeholder per RFE-005 scope ("NotificationBell with unread badge") — RFE-098 (Notifications,
 * needs an SMS/push provider decision, still `Blocked` in CURRENT_STATE.md) wires real unread counts.
 */
export function NotificationBell() {
  const t = useTranslations("topbar");

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
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>{t("notificationsHint")}</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" className="w-80">
        <p className="text-sm font-medium text-foreground">{t("notifications")}</p>
        <p className="mt-1 text-sm text-muted-foreground">No notifications yet.</p>
      </PopoverContent>
    </Popover>
  );
}
