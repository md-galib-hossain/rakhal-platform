"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { Check, CheckCircle2, Copy, Loader2, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@rakhal/ui/ui/button";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { qk } from "@/lib/query/keys";
import {
  useTelegramConnectSession,
  useTelegramStatus,
} from "../hooks/use-notifications";

interface TelegramConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TelegramConnectDialog({
  open,
  onOpenChange,
}: TelegramConnectDialogProps) {
  const t = useTranslations("settings.notifications.telegram");
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Fetch the connect session when the dialog is open and not yet completed
  const sessionQuery = useTelegramConnectSession(open && !isSuccess);

  // Poll Telegram link status every 2.5s while the dialog is open
  const statusQuery = useTelegramStatus({
    refetchInterval: open && !isSuccess ? 2500 : false,
  });

  // Reset state when dialog opens / closes
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- resets local UI flags when the controlled dialog closes
      setIsSuccess(false);
      setCopied(false);
    }
  }, [open]);

  // When status becomes linked, show celebration and auto-close after 1.5s
  useEffect(() => {
    if (!open) return;
    if (statusQuery.data?.linked) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reacts to the polled link status (external system)
      setIsSuccess(true);
      void queryClient.invalidateQueries({
        queryKey: qk.notifications.preferences(),
      });
      void queryClient.invalidateQueries({
        queryKey: qk.notifications.telegramStatus(),
      });
      const timer = setTimeout(() => {
        onOpenChange(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [open, statusQuery.data?.linked, onOpenChange, queryClient]);

  const session = sessionQuery.data;
  const digits = session?.code ? session.code.split("") : [];

  function handleCopy() {
    if (!session?.code) return;
    navigator.clipboard.writeText(session.code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => {
      // fallback if clipboard write fails
      setCopied(false);
    });
  }

  function handleOpenApp() {
    if (!session?.deepLink) return;
    window.open(session.deepLink, "_blank", "noopener,noreferrer");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)] p-6">
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
            {t("dialogTitle")}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-1">
            {t("dialogDescription")}
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center py-10 text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 mb-4 animate-bounce">
              <CheckCircle2 className="size-10" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              {t("connectedSuccess")}
            </h3>
          </div>
        ) : sessionQuery.isLoading ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Skeleton className="size-48 rounded-xl" />
            <Skeleton className="h-10 w-48" />
            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
              <Loader2 className="size-3.5 animate-spin" />
              <span>{t("sessionLoading")}</span>
            </div>
          </div>
        ) : sessionQuery.isError || !session ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-sm text-destructive">{t("sessionFailed")}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => sessionQuery.refetch()}
              className="mt-4"
            >
              {t("failedToGetLink")}
            </Button>
          </div>
        ) : !session.configured ? (
          <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground">
            <p className="text-sm">{t("notConfigured")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-5 pt-2">
            {/* Section A: Scan QR Code */}
            {session.qrPayload ? (
              <div className="flex flex-col items-center text-center">
                <div className="rounded-2xl border border-border/80 bg-white p-3 shadow-xs">
                  <QRCodeSVG
                    value={session.qrPayload}
                    size={170}
                    level="M"
                    marginSize={1}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2 font-medium">
                  {t("scanQrCaption")}
                </p>
              </div>
            ) : null}

            {/* Divider with Or */}
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <span className="relative bg-card px-3 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                {t("orCodeTitle")}
              </span>
            </div>

            {/* Section B: 6-digit code */}
            {session.code ? (
              <div className="flex flex-col items-center gap-2.5">
                <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                  {digits.map((digit, idx) => (
                    <span
                      key={idx}
                      className="flex size-10 sm:size-11 items-center justify-center rounded-lg border-2 border-border/90 bg-muted/30 font-mono text-xl sm:text-2xl font-bold tracking-tight text-foreground shadow-2xs"
                    >
                      {digit}
                    </span>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  {t("codeInstructions", {
                    botUsername: session.botUsername ?? "rakhal_farm_bot",
                  })}
                </p>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopy}
                  className="h-8 gap-1.5 text-xs font-medium mt-0.5"
                >
                  {copied ? (
                    <>
                      <Check className="size-3.5 text-emerald-600" />
                      <span>{t("copied")}</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>{t("copyCode")}</span>
                    </>
                  )}
                </Button>
              </div>
            ) : null}

            {/* Section C: Direct Action Button */}
            {session.deepLink ? (
              <div className="pt-1">
                <Button
                  type="button"
                  onClick={handleOpenApp}
                  className="w-full bg-[#229ED9] hover:bg-[#1e8ec3] text-white font-medium h-10 shadow-xs"
                >
                  <Send className="size-4 mr-2" />
                  {t("openTelegramApp")}
                </Button>
              </div>
            ) : null}

            {/* Real-time waiting indicator */}
            <div className="flex items-center justify-center gap-2 text-[11px] text-muted-foreground pt-1">
              <Loader2 className="size-3 animate-spin text-sky-500" />
              <span>{t("waitingForConnection")}</span>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
