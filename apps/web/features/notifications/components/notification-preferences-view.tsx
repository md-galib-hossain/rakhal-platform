"use client"; // form state + mutations over live preference data

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
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

/** External channels a farmer can toggle per event. `in_app` is always on (the free bell feed,
 * see `notification-events.ts`'s own doc comment) so it isn't offered as a checkbox.
 *
 * Deliberately empty for now (user scope decision, 2026-09-21: "avoid the sms for now we just
 * working with notifications in app"). None of these are actually reachable from the web app
 * today even though the backend's catalogue lists them: `sms`/`whatsapp`/`email` have no
 * provider at all; `telegram` has a provider (`TelegramBotProvider`) but needs both a configured
 * bot token AND a `/start` linking flow this app has no UI for; `push` has a real `FcmPushProvider`
 * but nothing here ever registers a browser device token (`POST /notifications/devices` — RFE-043's
 * own scope note explicitly skipped it), so no farmer using this web app has a token to deliver to.
 * Offering these as checkable meant a farmer could enable "SMS" and reasonably expect a text that
 * would never arrive. Re-populate this array (and drop the `only in-app` note below) once a channel
 * is genuinely wired end-to-end, not just backend-capable. */
const CHANNEL_KEYS: Array<keyof NotificationChannels> = [];

/**
 * RFE-043 — per-event channel toggles + quiet hours (PRD §20.3). Reads `NOTIFICATION_EVENTS`
 * (backend catalogue, RAKHAL-098) merged with the user's own overrides. Health & Safety events
 * are mandatory (`can_disable: false`) — their Enabled switch is locked on, matching the backend's
 * own `updatePreferences` rejection of a disable attempt on them.
 */
export function NotificationPreferencesView() {
  const t = useTranslations("settings.notifications");
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();

  // `null` = user hasn't touched the field yet — falls back to the fetched value at render time
  // (no effect+setState mirroring, same cascading-render pitfall RFE-109 already hit on this board).
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

  return (
    <div className="flex flex-col gap-8">
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
                  CHANNEL_KEYS.length > 0 ? (
                    <Can I="notification.update">
                      <div className="flex flex-wrap gap-4">
                        {CHANNEL_KEYS.map((channel) => (
                          <label key={channel} className="flex items-center gap-1.5 text-xs text-muted-foreground">
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
