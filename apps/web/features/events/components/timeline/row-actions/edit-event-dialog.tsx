"use client"; // dialog state + edit mutation

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@rakhal/ui/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { ApiError } from "@/lib/api/errors";
import { todayLocalIso } from "@/lib/local-date";
import { useEditEvent } from "../../../hooks/use-record-event";
import type { TimelineEvent } from "../../../timeline-model";

/** `YYYY-MM-DD` of an instant in the farmer's own day. */
function localDay(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Edit date + note (`PATCH /cattle/:id/events/:eventId`; RAKHAL-488 takes only those two). The server moves the typed
 * row, re-derives state and re-plans follow-ups, so the dialog says so instead of previewing the diff itself.
 */
export function EditEventDialog({
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
  const initialDay = localDay(event.eventAt);
  const [day, setDay] = useState(initialDay);
  const [notes, setNotes] = useState(event.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const edit = useEditEvent(cattleId);
  const today = todayLocalIso();

  async function submit() {
    if (!day || day > today) {
      setError(t("dateFuture"));
      return;
    }
    const body: { eventAt?: string; notes?: string | null } = {};
    if (day !== initialDay) {
      // Keep the original time of day; only the calendar day moves.
      const at = new Date(event.eventAt);
      const [y, m, d] = day.split("-").map(Number);
      at.setFullYear(y, m - 1, d);
      body.eventAt = at.getTime() > Date.now() ? new Date().toISOString() : at.toISOString();
    }
    if (notes.trim() !== (event.notes ?? "")) body.notes = notes.trim() === "" ? null : notes.trim();
    if (Object.keys(body).length === 0) {
      onOpenChange(false);
      return;
    }
    try {
      await edit.mutateAsync({ eventId: event.id, body });
      toast.success(t("editDone"));
      setError(null);
      onOpenChange(false);
    } catch (cause) {
      setError(cause instanceof ApiError && cause.status === 403 ? t("forbidden") : t("editError"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("editTitle")}</DialogTitle>
          <DialogDescription>{t("editHelp")}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`edit-date-${event.id}`} className="text-sm font-medium text-foreground">
            {t("date")}
          </label>
          <input
            id={`edit-date-${event.id}`}
            type="date"
            value={day}
            max={today}
            onChange={(e) => setDay(e.target.value)}
            className="h-11 rounded-md border border-border bg-background px-3 text-base text-foreground"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`edit-notes-${event.id}`} className="text-sm font-medium text-foreground">
            {t("notes")}
          </label>
          <Textarea id={`edit-notes-${event.id}`} value={notes} maxLength={2000} rows={3} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" className="h-11" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button type="button" className="h-11" disabled={edit.isPending} onClick={submit}>
            {edit.isPending ? t("saving") : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
