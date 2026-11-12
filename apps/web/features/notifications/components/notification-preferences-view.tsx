"use client"; // form state + mutations over live preference data

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Bell,
  Loader2,
  Lock,
  Moon,
  Search,
  Send,
  Smartphone,
  SlidersHorizontal,
} from "lucide-react";
import { Can } from "@/lib/auth/permissions";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { ErrorState } from "@/components/shared/error-state";
import { ApiError } from "@/lib/api/errors";
import {
  useNotificationPreferences,
  useTelegramStatus,
  useUnlinkTelegram,
  useUpdateNotificationPreferences,
} from "../hooks/use-notifications";
import { TelegramConnectDialog } from "./telegram-connect-dialog";
import { DeliveryChannelsHub, type DeliveryChannelKey } from "./delivery-channels-hub";
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

const STORAGE_KEY_CHANNEL_MUTES = "rakhal_notif_channel_mutes";

function loadChannelMutes(): Record<DeliveryChannelKey, boolean> {
  if (typeof window === "undefined") {
    return { telegram: false, sms: false, push: false, whatsapp: false, email: false };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CHANNEL_MUTES);
    if (!raw) return { telegram: false, sms: false, push: false, whatsapp: false, email: false };
    return JSON.parse(raw);
  } catch {
    return { telegram: false, sms: false, push: false, whatsapp: false, email: false };
  }
}

function saveChannelMutes(mutes: Record<DeliveryChannelKey, boolean>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_CHANNEL_MUTES, JSON.stringify(mutes));
  } catch {
    // Ignore storage errors
  }
}

/**
 * RFE-043 & RAKHAL-257 — Multi-channel notification settings matching project design system:
 * - Clean 2-color state representation:
 *   - Active: Brand primary green (--primary #00a86b fill / border / tint)
 *   - Inactive: Clean neutral muted (--muted / --muted-foreground / --border)
 * - Delivery Channels Hub with individual Master Active/Mute toggles.
 * - Telegram bot linking + self-service disconnect + soft mute without disconnect.
 * - Per-event personalization matrix with channel-specific toggles (Telegram, SMS, Push).
 * - Category filter pills + search input for quick personalization.
 * - Quiet hours (Do Not Disturb) window.
 */
export function NotificationPreferencesView() {
  const t = useTranslations("settings.notifications");
  const prefs = useNotificationPreferences();
  const update = useUpdateNotificationPreferences();
  const telegramStatus = useTelegramStatus();
  const unlinkTelegramMutation = useUnlinkTelegram();
  const [isConnectDialogOpen, setIsConnectDialogOpen] = useState(false);

  // Channel Master Mutes (turns off channel delivery across alerts without disconnecting account)
  const [channelMutes, setChannelMutes] = useState<Record<DeliveryChannelKey, boolean>>(() => loadChannelMutes());

  // Filter & Search states
  const [selectedCategory, setSelectedCategory] = useState<NotificationCategory | "ALL">("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // `null` = user hasn't touched the field yet — falls back to the fetched value at render time
  const [quietStartOverride, setQuietStartOverride] = useState<string | null>(null);
  const [quietEndOverride, setQuietEndOverride] = useState<string | null>(null);
  const quietStart = quietStartOverride ?? prefs.data?.quiet_hours.start ?? "";
  const quietEnd = quietEndOverride ?? prefs.data?.quiet_hours.end ?? "";

  function handleToggleChannelMute(channel: DeliveryChannelKey, muted: boolean) {
    setChannelMutes((prev) => {
      const next = { ...prev, [channel]: muted };
      saveChannelMutes(next);
      return next;
    });

    const channelName = t(`channels.${channel}`);
    if (muted) {
      toast.info(t("channelMutedToast", { channel: channelName }));
    } else {
      toast.success(t("channelActiveToast", { channel: channelName }));
    }
  }

  if (prefs.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-44 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  if (prefs.isError) {
    return <ErrorState description={t("loadError")} onRetry={() => prefs.refetch()} />;
  }

  const items = prefs.data?.preferences ?? [];
  const isTelegramLinked = Boolean(telegramStatus.data?.linked);

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

  function handleUnlinkTelegram() {
    unlinkTelegramMutation.mutate(undefined, {
      onSuccess: () => toast.success(t("telegram.disconnectedSuccess")),
      onError: (err) => toast.error(err instanceof ApiError ? err.message : t("saveError")),
    });
  }

  // Filter items by category and search query
  const filteredItems = items.filter((item) => {
    if (selectedCategory !== "ALL" && item.category !== selectedCategory) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const labelMatch = item.label.toLowerCase().includes(q);
      const keyMatch = item.event_key.toLowerCase().includes(q);
      return labelMatch || keyMatch;
    }
    return true;
  });

  const byCategory = new Map<NotificationCategory, NotificationPreferenceItem[]>();
  for (const item of filteredItems) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  // The API decides which categories exist: known ones keep their order, anything new is appended, not dropped.
  const presentCategories: NotificationCategory[] = [
    ...CATEGORY_ORDER.filter((c) => items.some((i) => i.category === c)),
    ...Array.from(new Set(items.map((i) => i.category))).filter((c) => !CATEGORY_ORDER.includes(c)),
  ];
  const categoryLabel = (cat: NotificationCategory) => (t.has(`categories.${cat}`) ? t(`categories.${cat}`) : cat);

  return (
    <div className="flex flex-col gap-6 pb-6">
      {/* 1. DELIVERY CHANNELS HUB (Telegram, SMS, Push, WhatsApp, Email) */}
      <DeliveryChannelsHub
        telegramStatus={telegramStatus}
        channelMutes={channelMutes}
        onToggleChannelMute={handleToggleChannelMute}
        onOpenTelegramConnect={() => setIsConnectDialogOpen(true)}
        onUnlinkTelegram={handleUnlinkTelegram}
        isUnlinkingTelegram={unlinkTelegramMutation.isPending}
      />

      {/* 2. QUIET HOURS (DND Window) */}
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground">
            <Moon className="size-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">{t("quietHours")}</p>
            <p className="text-xs text-muted-foreground">{t("quietHoursDescription")}</p>
          </div>
        </div>

        <Can I="notification.update">
          <div className="flex flex-wrap items-end gap-3 pt-1">
            <div className="flex flex-col gap-1">
              <Label htmlFor="quiet-start" className="text-xs text-muted-foreground">
                {t("quietHoursStart")}
              </Label>
              <input
                id="quiet-start"
                type="time"
                value={quietStart}
                onChange={(e) => setQuietStartOverride(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="quiet-end" className="text-xs text-muted-foreground">
                {t("quietHoursEnd")}
              </Label>
              <input
                id="quiet-end"
                type="time"
                value={quietEnd}
                onChange={(e) => setQuietEndOverride(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-2.5 text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={saveQuietHours}
              disabled={update.isPending || !quietStart || !quietEnd}
              className="h-9"
            >
              {update.isPending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
              {t("save")}
            </Button>
          </div>
        </Can>
      </section>

      {/* 3. NOTIFICATION ROUTING & PERSONALIZATION */}
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-3">
          <div>
            <h2 className="text-base font-semibold text-foreground tracking-tight">
              {t("routingTitle")}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("routingSubtitle")}
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder={t("searchAlerts")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8.5 pl-8.5 text-xs bg-background"
            />
          </div>
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <Button
            variant={selectedCategory === "ALL" ? "primary" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory("ALL")}
            className="h-7 px-2.5 text-xs rounded-full"
          >
            {t("allCategories")}
          </Button>
          {presentCategories.map((cat) => (
            <Button
              key={cat}
              variant={selectedCategory === cat ? "primary" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat)}
              className="h-7 px-2.5 text-xs rounded-full"
            >
              {categoryLabel(cat)}
            </Button>
          ))}
        </div>

        {/* Items List grouped by Category */}
        {filteredItems.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-xs text-muted-foreground">
            {t("noMatchingAlerts")}
          </div>
        ) : (
          <div className="flex flex-col gap-6">
            {presentCategories.filter((c) => byCategory.has(c)).map((category) => (
              <div key={category} className="flex flex-col gap-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {categoryLabel(category)}
                  </h3>
                  <span className="text-[11px] text-muted-foreground">
                    {t("alertCount", { count: byCategory.get(category)!.length })}
                  </span>
                </div>

                <div className="flex flex-col divide-y divide-border rounded-xl border border-border bg-card shadow-xs">
                  {byCategory.get(category)!.map((item) => {
                    const isMutedByChannel = {
                      telegram: isTelegramLinked && channelMutes.telegram,
                      sms: channelMutes.sms,
                      push: channelMutes.push,
                    };

                    return (
                      <div key={item.event_key} data-testid={`pref-${item.event_key}`} className="flex flex-col gap-3 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex min-w-0 flex-col gap-0.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-sm font-medium text-foreground">
                                {item.label}
                              </span>
                              {!item.can_disable ? (
                                <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0 font-normal">
                                  <Lock className="size-2.5" aria-hidden />
                                  {t("mandatory")}
                                </Badge>
                              ) : null}
                            </div>
                            {!item.can_disable ? (
                              <span className="text-[11px] text-muted-foreground">{t("mandatoryHint")}</span>
                            ) : null}
                          </div>

                          <div className="flex shrink-0 items-center gap-2">
                            <Switch
                              aria-label={t("toggleAlert", { label: item.label })}
                              checked={item.enabled}
                              disabled={!item.can_disable || update.isPending}
                              onCheckedChange={(checked) => toggleEnabled(item, checked)}
                            />
                          </div>
                        </div>

                        {/* Channel personalization toggles: 2-color state (primary green for active, neutral muted for inactive) */}
                        {item.enabled ? (
                          <div className="flex flex-col gap-2 pt-1 border-t border-border/50">
                            <span className="text-[11px] font-medium text-muted-foreground mr-1 flex items-center gap-1">
                              <SlidersHorizontal className="size-3" />
                              {t("deliveryVia")}
                            </span>

                            <Can I="notification.update">
                              <div className="flex flex-wrap items-center gap-2">
                                {/* Telegram Pill Toggle */}
                                <label
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer select-none ${
                                    item.channels.telegram
                                      ? isMutedByChannel.telegram
                                        ? "border-border bg-muted/60 text-muted-foreground line-through opacity-75"
                                        : "border-primary/40 bg-primary/10 text-primary font-medium"
                                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                                  }`}
                                >
                                  <Checkbox
                                    checked={item.channels.telegram}
                                    disabled={update.isPending}
                                    onCheckedChange={(checked) =>
                                      toggleChannel(item, "telegram", checked === true)
                                    }
                                    className="size-3.5"
                                  />
                                  <Send className="size-3" />
                                  <span>{t("channels.telegram")}</span>
                                  {isMutedByChannel.telegram ? (
                                    <span className="text-[10px] font-normal no-underline text-muted-foreground">
                                      {t("mutedSuffix")}
                                    </span>
                                  ) : null}
                                </label>

                                {/* SMS Pill Toggle */}
                                <label
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer select-none ${
                                    item.channels.sms
                                      ? isMutedByChannel.sms
                                        ? "border-border bg-muted/60 text-muted-foreground line-through opacity-75"
                                        : "border-primary/40 bg-primary/10 text-primary font-medium"
                                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                                  }`}
                                >
                                  <Checkbox
                                    checked={item.channels.sms}
                                    disabled={update.isPending}
                                    onCheckedChange={(checked) =>
                                      toggleChannel(item, "sms", checked === true)
                                    }
                                    className="size-3.5"
                                  />
                                  <Smartphone className="size-3" />
                                  <span>{t("channels.sms")}</span>
                                  {isMutedByChannel.sms ? (
                                    <span className="text-[10px] font-normal no-underline text-muted-foreground">
                                      {t("mutedSuffix")}
                                    </span>
                                  ) : null}
                                </label>

                                {/* In-App / Push Pill Toggle */}
                                <label
                                  className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs transition-colors cursor-pointer select-none ${
                                    item.channels.push
                                      ? isMutedByChannel.push
                                        ? "border-border bg-muted/60 text-muted-foreground line-through opacity-75"
                                        : "border-primary/40 bg-primary/10 text-primary font-medium"
                                      : "border-border bg-muted/30 text-muted-foreground hover:bg-muted/60"
                                  }`}
                                >
                                  <Checkbox
                                    checked={item.channels.push}
                                    disabled={update.isPending}
                                    onCheckedChange={(checked) =>
                                      toggleChannel(item, "push", checked === true)
                                    }
                                    className="size-3.5"
                                  />
                                  <Bell className="size-3" />
                                  <span>{t("channels.push")}</span>
                                </label>
                              </div>
                            </Can>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Connect Telegram Dialog */}
      <TelegramConnectDialog
        open={isConnectDialogOpen}
        onOpenChange={setIsConnectDialogOpen}
      />
    </div>
  );
}
