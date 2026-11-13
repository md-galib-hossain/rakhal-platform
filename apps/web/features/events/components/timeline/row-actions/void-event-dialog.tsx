"use client"; // dialog state + void mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@rakhal/ui/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { ApiError } from "@/lib/api/errors";
import { useVoidEvent } from "../../../hooks/use-record-event";
import type { TimelineEvent } from "../../../timeline-model";

/** Void asks for a reason (the route requires one) and warns for calving, whose calves are not deleted (03 §3.4). */
export function VoidEventDialog({
  cattleId,
  event,
  open,
  onOpenChange,
}: {
  cattleId: string;
  event: TimelineEvent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("events.timeline.actions");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const voidEvent = useVoidEvent(cattleId);

  async function submit() {
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(t("reasonRequired"));
      return;
    }
    try {
      await voidEvent.mutateAsync({ ref: event.id, reason: trimmed });
      toast.success(t("voidDone"));
      setReason("");
      setError(null);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 403 ? t("forbidden") : t("voidError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("voidTitle")}</DialogTitle>
          <DialogDescription>{t("voidHelp")}</DialogDescription>
        </DialogHeader>
        {event.type === "CALVING" ? (
          <p role="note" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-foreground">
            {t("calvingWarning")}
          </p>
        ) : null}
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`void-reason-${event.id}`} className="text-sm font-medium text-foreground">
            {t("reason")}
          </label>
          <Textarea
            id={`void-reason-${event.id}`}
            value={reason}
            maxLength={500}
            rows={3}
            aria-invalid={error ? true : undefined}
            onChange={(e) => setReason(e.target.value)}
          />
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" variant="destructive" className="h-11" disabled={voidEvent.isPending} onClick={submit}>
            {voidEvent.isPending ? t("voiding") : t("void")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
