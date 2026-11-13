"use client";

import { useTranslations } from "next-intl";
import {
  Send,
  MessageSquare,
  Bell,
  Smartphone,
  Mail,
  CheckCircle2,
  QrCode,
  Loader2,
} from "lucide-react";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import { Switch } from "@rakhal/ui/ui/switch";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { Can } from "@/lib/auth/permissions";
import type { TelegramStatusResult } from "../types";

export type DeliveryChannelKey = "telegram" | "sms" | "push" | "whatsapp" | "email";

export interface DeliveryChannelsHubProps {
  telegramStatus: {
    data?: TelegramStatusResult;
    isLoading: boolean;
  };
  channelMutes: Record<DeliveryChannelKey, boolean>;
  onToggleChannelMute: (channel: DeliveryChannelKey, muted: boolean) => void;
  onOpenTelegramConnect: () => void;
  onUnlinkTelegram: () => void;
  isUnlinkingTelegram: boolean;
}

export function DeliveryChannelsHub({
  telegramStatus,
  channelMutes,
  onToggleChannelMute,
  onOpenTelegramConnect,
  onUnlinkTelegram,
  isUnlinkingTelegram,
}: DeliveryChannelsHubProps) {
  const t = useTranslations("settings.notifications");

  const isTelegramLinked = Boolean(telegramStatus.data?.linked);
  const isTelegramMuted = Boolean(channelMutes.telegram);
  const isTelegramActive = isTelegramLinked && !isTelegramMuted;

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-base font-semibold text-foreground tracking-tight">
          {t("deliveryChannelsTitle")}
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("deliveryChannelsSubtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {/* 1. TELEGRAM BOT CHANNEL */}
        <div
          data-testid="channel-card-telegram"
          className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
            isTelegramActive
              ? "border-primary/40 bg-card ring-1 ring-primary/20"
              : "border-border bg-card"
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    isTelegramActive
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Send className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      {t("channels.telegram")}
                    </span>
                    {telegramStatus.isLoading ? (
                      <Skeleton className="h-4 w-12" />
                    ) : isTelegramLinked ? (
                      <Badge
                        variant={isTelegramActive ? "default" : "outline"}
                        className="text-[10px] px-1.5 py-0"
                      >
                        {isTelegramActive ? (
                          <>
                            <CheckCircle2 className="size-2.5 mr-0.5" />
                            {t("channelActive")}
                          </>
                        ) : (
                          t("channelMuted")
                        )}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                        {t("telegram.statusNotConnected")}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {telegramStatus.data?.linked && telegramStatus.data.count > 0
                      ? t("telegram.activeChats", { count: telegramStatus.data.count })
                      : t("hub.telegramTagline")}
                  </span>
                </div>
              </div>

              {/* Master Mute / Active switch when connected */}
              {isTelegramLinked ? (
                <Can I="notification.update">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-medium text-muted-foreground">
                      {isTelegramMuted ? t("channelMuted") : t("channelActive")}
                    </span>
                    <Switch
                      aria-label={t("hub.toggleTelegram")}
                      checked={!isTelegramMuted}
                      onCheckedChange={(active) => onToggleChannelMute("telegram", !active)}
                    />
                  </div>
                </Can>
              ) : null}
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2">
              {t("channelDescriptions.telegram")}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {isTelegramLinked
                ? isTelegramActive
                  ? t("hub.stateActive")
                  : t("hub.stateMuted")
                : t("hub.stateNotConnected")}
            </span>

            <Can I="notification.update">
              {telegramStatus.isLoading ? (
                <Skeleton className="h-8 w-20" />
              ) : isTelegramLinked ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onUnlinkTelegram}
                  disabled={isUnlinkingTelegram}
                  className="h-7.5 px-2.5 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40"
                >
                  {isUnlinkingTelegram ? (
                    <Loader2 className="size-3 mr-1 animate-spin" />
                  ) : null}
                  {t("telegram.disconnect")}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={onOpenTelegramConnect}
                  disabled={!telegramStatus.data?.configured}
                  className="h-7.5 px-2.5 text-xs"
                >
                  <QrCode className="size-3 mr-1" />
                  {t("telegram.connect")}
                </Button>
              )}
            </Can>
          </div>
        </div>

        {/* 2. SMS CHANNEL */}
        <div
          data-testid="channel-card-sms"
          className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
            !channelMutes.sms
              ? "border-primary/40 bg-card ring-1 ring-primary/20"
              : "border-border bg-card"
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    !channelMutes.sms
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Smartphone className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      {t("channels.sms")}
                    </span>
                    <Badge
                      variant={!channelMutes.sms ? "default" : "outline"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {!channelMutes.sms ? t("channelActive") : t("channelMuted")}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {t("hub.smsTagline")}
                  </span>
                </div>
              </div>

              <Can I="notification.update">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {channelMutes.sms ? t("channelMuted") : t("channelActive")}
                  </span>
                  <Switch
                    aria-label={t("hub.toggleSms")}
                    checked={!channelMutes.sms}
                    onCheckedChange={(active) => onToggleChannelMute("sms", !active)}
                  />
                </div>
              </Can>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2">
              {t("channelDescriptions.sms")}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {!channelMutes.sms ? t("channelActive") : t("channelMuted")}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled
              className="h-7.5 px-2.5 text-xs text-muted-foreground"
            >
              {t("channelAction.configure")}
            </Button>
          </div>
        </div>

        {/* 3. IN-APP & WEB PUSH CHANNEL */}
        <div
          data-testid="channel-card-push"
          className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
            !channelMutes.push
              ? "border-primary/40 bg-card ring-1 ring-primary/20"
              : "border-border bg-card"
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
                    !channelMutes.push
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  <Bell className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      {t("channels.push")}
                    </span>
                    <Badge
                      variant={!channelMutes.push ? "default" : "outline"}
                      className="text-[10px] px-1.5 py-0"
                    >
                      {!channelMutes.push ? t("channelActive") : t("channelMuted")}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    {t("hub.pushTagline")}
                  </span>
                </div>
              </div>

              <Can I="notification.update">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {channelMutes.push ? t("channelMuted") : t("channelActive")}
                  </span>
                  <Switch
                    aria-label={t("hub.togglePush")}
                    checked={!channelMutes.push}
                    onCheckedChange={(active) => onToggleChannelMute("push", !active)}
                  />
                </div>
              </Can>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2">
              {t("channelDescriptions.push")}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">
              {!channelMutes.push ? t("channelActive") : t("channelMuted")}
            </span>
            <Button
              variant="outline"
              size="sm"
              disabled
              className="h-7.5 px-2.5 text-xs text-muted-foreground"
            >
              {t("channelAction.manage")}
            </Button>
          </div>
        </div>

        {/* 4. WHATSAPP (Upcoming Seam) */}
        <div
          data-testid="channel-card-whatsapp"
          className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 opacity-75"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <MessageSquare className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      {t("channels.whatsapp")}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                      {t("channelStatus.comingSoon")}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{t("hub.whatsappTagline")}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2">
              {t("channelDescriptions.whatsapp")}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">{t("hub.seamReady")}</span>
            <Button variant="outline" size="sm" disabled className="h-7.5 px-2.5 text-xs text-muted-foreground">
              {t("channelAction.connect")}
            </Button>
          </div>
        </div>

        {/* 5. EMAIL (Upcoming Seam) */}
        <div
          data-testid="channel-card-email"
          className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 opacity-75"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                  <Mail className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      {t("channels.email")}
                    </span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                      {t("channelStatus.comingSoon")}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">{t("hub.emailTagline")}</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2">
              {t("channelDescriptions.email")}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">{t("hub.seamReady")}</span>
            <Button variant="outline" size="sm" disabled className="h-7.5 px-2.5 text-xs text-muted-foreground">
              {t("channelAction.connect")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
