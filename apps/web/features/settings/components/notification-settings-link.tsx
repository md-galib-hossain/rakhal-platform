"use client"; // click handler drives the shared notification-sheet store

import { useTranslations } from "next-intl";
import { Bell } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { openNotificationSheet } from "@/features/notifications/sheet-store";

/** Settings > Notifications. Preferences, delivery channels and Telegram live in the notification sheet's settings
 * view (NV2-F05); this tab is only the entry point that opens it. */
export function NotificationSettingsLink() {
  const t = useTranslations("settings.notifications");

  return (
    <div className="flex max-w-xl flex-col items-start gap-4 rounded-xl border border-border bg-card p-5">
      <div className="flex size-10 items-center justify-center rounded-lg bg-muted text-foreground">
        <Bell className="size-5" aria-hidden />
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">{t("openInSheetTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("openInSheetDescription")}</p>
      </div>
      <Button onClick={() => openNotificationSheet("settings")}>{t("openInSheet")}</Button>
    </div>
  );
}
