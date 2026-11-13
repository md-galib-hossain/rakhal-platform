"use client"; // choice + reason state, pending mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

export type RemoveMode = "stop" | "cancel";

/**
 * Taking one animal off a protocol has two honest meanings, so the farmer picks one instead of guessing:
 *  - **Stop** — the protocol ends here. Steps not done yet are skipped; doses already recorded stay (stock, costs, history).
 *  - **Cancel** — it was applied by mistake. Every step is deleted and every recorded dose reversed (stock back, expense
 *    reversed, withdrawal cancelled) — in one call, not step by step. A sickness case that exists only because of this apply
 *    is removed with it.
 * Shared by the round's Progress table and the cow's own Protocols section.
 */
export function ProtocolRemoveDialog({
  open,
  onOpenChange,
  protocolName,
  hasCase,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocolName: string;
  /** A treatment protocol (backed by a sickness case) vs a preventive / breeding round. */
  hasCase: boolean;
  onConfirm: (mode: RemoveMode, reason: string | undefined) => void | Promise<void>;
}) {
  const t = useTranslations("health.protocolUndo");
  const [mode, setMode] = useState<RemoveMode>("stop");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  async function confirm() {
    setPending(true);
    try {
      await onConfirm(mode, reason.trim() || undefined);
      onOpenChange(false);
    } catch {
      // The caller already toasted the error; stay open so the farmer can retry or pick the other option.
    } finally {
      setPending(false);
    }
  }

  const options: { value: RemoveMode; title: string; body: string }[] = [
    { value: "stop", title: t("stopTitle"), body: hasCase ? t("stopBodyCase") : t("stopBodyRound") },
    { value: "cancel", title: t("cancelTitle"), body: hasCase ? t("cancelBodyCase") : t("cancelBodyRound") },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        showClose={false}
        className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-md sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
      >
        <div className="flex items-center justify-between pb-5">
          <SheetTitle className="text-xl font-bold text-foreground">{t("title", { protocol: protocolName })}</SheetTitle>
          <button type="button" onClick={() => onOpenChange(false)} aria-label={t("back")} className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70">
            <ArrowRightToLine className="size-5" aria-hidden />
          </button>
        </div>
        <div className="border-t border-dashed border-border" />
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto py-4">
          <SheetDescription className="sr-only">{t("description")}</SheetDescription>
          <div role="radiogroup" aria-label={t("title", { protocol: protocolName })} className="flex flex-col gap-3">
            {options.map((option) => (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={mode === option.value}
                onClick={() => setMode(option.value)}
                className={cn(
                  "flex flex-col gap-1 rounded-xl border p-3 text-left transition-colors",
                  mode === option.value ? (option.value === "cancel" ? "border-destructive bg-destructive/5" : "border-primary bg-success-tint") : "border-border",
                )}
              >
                <span className="text-sm font-semibold text-foreground">{option.title}</span>
                <span className="text-xs text-muted-foreground">{option.body}</span>
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="protocol-undo-reason" className="text-xs text-muted-foreground">
              {t("reasonLabel")}
            </label>
            <Textarea id="protocol-undo-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("reasonPlaceholder")} className="h-20" />
          </div>
        </div>
        <div className="border-t border-dashed border-border" />
        <div className="flex gap-3 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("back")}
          </Button>
          <Button type="button" variant={mode === "cancel" ? "destructive" : "primary"} className="h-12 flex-1" onClick={confirm} disabled={pending}>
            {pending ? "…" : mode === "cancel" ? t("confirmCancel") : t("confirmStop")}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
