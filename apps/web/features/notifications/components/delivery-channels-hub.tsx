"use client";

import { useTranslations } from "next-intl";
import {
  Send,
  MessageSquare,
  Bell,
  Smartphone,
  Mail,
  CheckCircle2,
  AlertCircle,
  QrCode,
  Loader2,
  Power,
  PowerOff,
  Sparkles,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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

  return (
    <section className="flex flex-col gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-foreground tracking-tight">
            {t("deliveryChannelsTitle")}
          </h2>
          <Badge variant="outline" className="text-[11px] font-normal border-primary/20 text-primary">
            <Sparkles className="size-3 mr-1" />
            Multi-Channel
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {t("deliveryChannelsSubtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {/* 1. TELEGRAM BOT CHANNEL */}
        <div
          data-testid="channel-card-telegram"
          className={`flex flex-col justify-between rounded-xl border p-4 transition-colors ${
            isTelegramLinked
              ? isTelegramMuted
                ? "border-amber-500/30 bg-amber-500/[0.02]"
                : "border-sky-500/30 bg-sky-500/[0.02]"
              : "border-border bg-card hover:border-border/80"
          }`}
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-lg ${
                    isTelegramLinked
                      ? "bg-sky-500/15 text-sky-600 dark:text-sky-400"
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
                      <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                        <CheckCircle2 className="size-2.5 mr-0.5" />
                        {t("telegram.statusConnected")}
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
                      : "Instant Bot Delivery"}
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
                      aria-label="Toggle Telegram notifications delivery"
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

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              {isTelegramLinked ? (
                isTelegramMuted ? (
                  <>
                    <PowerOff className="size-3 text-amber-500" />
                    <span>Muted (no alerts sent)</span>
                  </>
                ) : (
                  <>
                    <Power className="size-3 text-emerald-500" />
                    <span>Active & receiving</span>
                  </>
                )
              ) : (
                <span>Requires bot linking</span>
              )}
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
                  className="h-7.5 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30"
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
                  className="h-7.5 px-2.5 text-xs bg-sky-600 hover:bg-sky-700 text-white"
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
          className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <Smartphone className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      {t("channels.sms")}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-muted-foreground">
                      {t("channelStatus.ready")}
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Verified phone number
                  </span>
                </div>
              </div>

              <Can I="notification.update">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {channelMutes.sms ? t("channelMuted") : t("channelActive")}
                  </span>
                  <Switch
                    aria-label="Toggle SMS notifications delivery"
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

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              {channelMutes.sms ? (
                <>
                  <PowerOff className="size-3 text-amber-500" />
                  <span>Muted</span>
                </>
              ) : (
                <>
                  <Power className="size-3 text-emerald-500" />
                  <span>Active</span>
                </>
              )}
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
          className="flex flex-col justify-between rounded-xl border border-border bg-card p-4 transition-colors"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400">
                  <Bell className="size-4.5" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold text-foreground">
                      {t("channels.push")}
                    </span>
                    <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[10px] px-1.5 py-0">
                      <CheckCircle2 className="size-2.5 mr-0.5" />
                      Active
                    </Badge>
                  </div>
                  <span className="text-[11px] text-muted-foreground">
                    Web & in-app bell
                  </span>
                </div>
              </div>

              <Can I="notification.update">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {channelMutes.push ? t("channelMuted") : t("channelActive")}
                  </span>
                  <Switch
                    aria-label="Toggle Push notifications delivery"
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

          <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Power className="size-3 text-emerald-500" />
              <span>Always available</span>
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
          className="flex flex-col justify-between rounded-xl border border-dashed border-border/80 bg-card/50 p-4"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/10 text-emerald-600">
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
                  <span className="text-[11px] text-muted-foreground">WhatsApp Business API</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2">
              {t("channelDescriptions.whatsapp")}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">Modular integration ready</span>
            <Button variant="ghost" size="sm" disabled className="h-7.5 px-2.5 text-xs opacity-60">
              {t("channelAction.connect")}
            </Button>
          </div>
        </div>

        {/* 5. EMAIL (Upcoming Seam) */}
        <div
          data-testid="channel-card-email"
          className="flex flex-col justify-between rounded-xl border border-dashed border-border/80 bg-card/50 p-4"
        >
          <div className="flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
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
                  <span className="text-[11px] text-muted-foreground">SMTP & Resend Engine</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-muted-foreground line-clamp-2">
              {t("channelDescriptions.email")}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-border/40 flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground">Modular integration ready</span>
            <Button variant="ghost" size="sm" disabled className="h-7.5 px-2.5 text-xs opacity-60">
              {t("channelAction.connect")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
