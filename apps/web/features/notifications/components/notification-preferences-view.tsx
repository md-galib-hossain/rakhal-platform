"use client"; // form state + mutations over live preference data

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { CheckCircle2, ExternalLink, Loader2, Send } from "lucide-react";
import { Can } from "@/lib/auth/permissions";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { ApiError } from "@/lib/api/errors";
import {
  useNotificationPreferences,
  useTelegramLinkToken,
  useTelegramStatus,
  useUnlinkTelegram,
  useUpdateNotificationPreferences,
} from "../hooks/use-notifications";
import type {
  NotificationCategory,
  NotificationChannels,
  NotificationPreferenceItem,
} from "../types";

const CATEGORY_ORDER: NotificationCategory[] = [
  "health_safety",
  "reproduction",
  "operational",
  "financial",
  "inventory",
];

/**
 * RFE-043 & RAKHAL-257 — per-event channel toggles + quiet hours + Telegram bot connection.
 * Reads `NOTIFICATION_EVENTS` catalogue merged with the user's own overrides.
 * Health & Safety events are mandatory (`can_disable: false`) — their Enabled switch is locked on.
 * Telegram bot alerts can be linked via `/start` deep link and unlinked self-service.
 */
export function NotificationPreferencesView() {
  const t = useTranslations("settings.notifications");
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const telegramStatus = useTelegramStatus();
  const linkTokenMutation = useTelegramLinkToken();
  const unlinkTelegramMutation = useUnlinkTelegram();

  // `null` = user hasn't touched the field yet — falls back to the fetched value at render time
  const [quietStartOverride, setQuietStartOverride] = useState<string | null>(null);
  const [quietEndOverride, setQuietEndOverride] = useState<string | null>(null);
  const quietStart = quietStartOverride ?? prefs.data?.quiet_hours.start ?? "";
  const quietEnd = quietEndOverride ?? prefs.data?.quiet_hours.end ?? "";

  if (prefs.isLoading) {
    return (
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (prefs.isError) {
    return <ErrorState description={t("loadError")} onRetry={() => prefs.refetch()} />;
  }

  const items = prefs.data?.preferences ?? [];
  const byCategory = new Map<NotificationCategory, NotificationPreferenceItem[]>();
  for (const item of items) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const isTelegramLinked = Boolean(telegramStatus.data?.linked);
  const activeChannels: Array<keyof NotificationChannels> = isTelegramLinked ? ["telegram"] : [];

  function toggleEnabled(item: NotificationPreferenceItem, enabled: boolean) {
    update.mutate(
      { preferences: [{ event_key: item.event_key, enabled }] },
      { onError: (err) => toast.error(err instanceof ApiError ? err.message : t("saveError")) },
    );
  }

  function toggleChannel(item: NotificationPreferenceItem, channel: keyof NotificationChannels, checked: boolean) {
    update.mutate(
      { preferences: [{ event_key: item.event_key, channels: { ...item.channels, [channel]: checked } }] },
      { onError: (err) => toast.error(err instanceof ApiError ? err.message : t("saveError")) },
    );
  }

  function saveQuietHours() {
    if (!quietStart || !quietEnd) return;
    update.mutate(
      { quiet_hours: { start: quietStart, end: quietEnd } },
      {
        onSuccess: () => toast.success(t("quietHoursSaved")),
        onError: (err) => toast.error(err instanceof ApiError ? err.message : t("saveError")),
      },
    );
  }

  function handleConnectTelegram() {
    linkTokenMutation.mutate(undefined, {
      onSuccess: (data) => {
        if (data.deepLink) {
          window.open(data.deepLink, "_blank", "noopener,noreferrer");
          toast.success(t("telegram.connecting"));
        } else {
          toast.error(t("telegram.notConfigured"));
        }
      },
      onError: () => toast.error(t("telegram.failedToGetLink")),
    });
  }

  function handleUnlinkTelegram() {
    unlinkTelegramMutation.mutate(undefined, {
      onSuccess: () => toast.success(t("telegram.disconnectedSuccess")),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : t("saveError")),
    });
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Telegram Bot Connection Card */}
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Send className="size-5" />
            </div>
            <div className="flex flex-col gap-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold text-foreground">
                  {t("telegram.title")}
                </h3>
                {telegramStatus.isLoading ? (
                  <Skeleton className="h-5 w-20" />
                ) : telegramStatus.data?.linked ? (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">
                    <CheckCircle2 className="size-3 mr-1" />
                    {t("telegram.statusConnected")}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-muted-foreground">
                    {t("telegram.statusNotConnected")}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground max-w-xl">
                {t("telegram.description")}
              </p>
              {telegramStatus.data?.linked && telegramStatus.data.count > 0 ? (
                <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mt-0.5">
                  {t("telegram.activeChats", { count: telegramStatus.data.count })}
                </p>
              ) : null}
            </div>
          </div>

          <Can I="notification.update">
            <div className="flex items-center gap-2 shrink-0">
              {telegramStatus.isLoading ? (
                <Skeleton className="h-9 w-28" />
              ) : telegramStatus.data?.linked ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleUnlinkTelegram}
                  disabled={unlinkTelegramMutation.isPending}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
                >
                  {unlinkTelegramMutation.isPending ? (
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  ) : null}
                  {t("telegram.disconnect")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={handleConnectTelegram}
                  disabled={linkTokenMutation.isPending || !telegramStatus.data?.configured}
                  className="bg-sky-600 hover:bg-sky-700 text-white"
                >
                  {linkTokenMutation.isPending ? (
                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <ExternalLink className="size-3.5 mr-1.5" />
                  )}
                  {t("telegram.connect")}
                </Button>
              )}
            </div>
          </Can>
        </div>
      </section>

      {/* Quiet Hours Settings */}
      <section className="flex flex-col gap-3 rounded-xl border border-border p-4">
        <div>
          <p className="text-sm font-medium text-foreground">{t("quietHours")}</p>
          <p className="text-xs text-muted-foreground">{t("quietHoursDescription")}</p>
        </div>
        <Can I="notification.update">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="quiet-start" className="text-xs">
                {t("quietHoursStart")}
              </Label>
              <input
                id="quiet-start"
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStartOverride(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="quiet-end" className="text-xs">
                {t("quietHoursEnd")}
              </Label>
              <input
                id="quiet-end"
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEndOverride(e.target.value)}
                className="h-9 rounded-md border border-input bg-card px-2 text-sm"
              />
            </div>
            <Button size="sm" onClick={saveQuietHours} disabled={update.isPending || !quietStart || !quietEnd}>
              {update.isPending ? <Loader2 className="size-3.5 animate-spin" /> : null}
              {t("save")}
            </Button>
          </div>
        </Can>
      </section>

      {/* Categories & Channel Toggles */}
      {CATEGORY_ORDER.filter((c) => byCategory.has(c)).map((category) => (
        <section key={category} className="flex flex-col gap-3">
          <h3 className="text-sm font-semibold text-foreground">{t(`categories.${category}`)}</h3>
          <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
            {byCategory.get(category)!.map((item) => (
              <div key={item.event_key} className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    {!item.can_disable ? <Badge variant="destructive">{t("mandatory")}</Badge> : null}
                  </div>
                  <Switch
                    checked={item.enabled}
                    disabled={!item.can_disable || update.isPending}
                    onCheckedChange={(checked) => toggleEnabled(item, checked)}
                  />
                </div>
                {item.enabled ? (
                  activeChannels.length > 0 ? (
                    <Can I="notification.update">
                      <div className="flex flex-wrap gap-4">
                        {activeChannels.map((channel) => (
                          <label
                            key={channel}
                            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            <Checkbox
                              checked={item.channels[channel]}
                              disabled={update.isPending}
                              onCheckedChange={(checked) => toggleChannel(item, channel, checked === true)}
                            />
                            {t(`channels.${channel}`)}
                          </label>
                        ))}
                      </div>
                    </Can>
                  ) : (
                    <p className="text-xs text-muted-foreground">{t("inAppOnlyNote")}</p>
                  )
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
