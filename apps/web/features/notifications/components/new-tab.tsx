"use client"; // owns the create/edit form lifecycle (reset after save)

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSchedule } from "../hooks/use-schedules";
import type { ComposerAnchor, ComposerAnimal } from "../schedule-model";
import { ScheduleForm } from "./schedule-form";

export interface NewTabProps {
  /** Edit mode: the shell wires F03's `onEdit(id)` to this. */
  editingId?: string | null;
  /** Create mode: what the notice is relative to (F06 "Remind me" entry points). */
  anchor?: ComposerAnchor | null;
  animal?: ComposerAnimal;
  /** After a successful create / save (the shell goes to Upcoming, or clears `editingId`). */
  onDone?: () => void;
  /** Edit mode: leave without saving. */
  onCancel?: () => void;
}

/** NV2-F04 New tab: the composer for a manual notification, and the editor when `editingId` is set. */
export function NewTab({ editingId, anchor, animal, onDone, onCancel }: NewTabProps) {
  const t = useTranslations("notificationSheet.compose");
  // Bumped after a create so the form remounts empty instead of keeping the last draft.
  const [round, setRound] = useState(0);
  const existing = useSchedule(editingId);

  if (editingId) {
    if (existing.isLoading) {
      return (
        <div className="flex flex-col gap-3 pt-3" aria-busy="true">
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      );
    }
    if (existing.isError || !existing.data) {
      return (
        <div className="flex flex-col items-start gap-2 pt-3" role="alert">
          <p className="text-sm text-destructive">{t("loadError")}</p>
          <Button variant="secondary" onClick={() => existing.refetch()}>
            {t("retry")}
          </Button>
        </div>
      );
    }
    return <ScheduleForm key={existing.data.id} schedule={existing.data} onDone={onDone} onCancel={onCancel} />;
  }

  return (
    <ScheduleForm
      key={round}
      anchor={anchor}
      animal={animal}
      onDone={() => {
        setRound((n) => n + 1);
        onDone?.();
      }}
    />
  );
}
