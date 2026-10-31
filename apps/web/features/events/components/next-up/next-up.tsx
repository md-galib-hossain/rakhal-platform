"use client"; // live upcoming-events query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCan } from "@/lib/auth/permissions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useUpcomingEvents } from "@/features/cattle/hooks/use-cattle";
import { KIND_ICON, useEventText } from "@/features/cattle/components/upcoming-event-row";
import type { UpcomingEvent } from "@/features/cattle/types";
import { canSnoozeSkip, recordKeyFor } from "../../next-up-model";
import type { ReminderAnimal } from "../../reminders/reminder-model";
import { useReminderTask } from "../../reminders/use-reminders";
import type { Task } from "@/features/tasks/types";
import type { EventKey } from "../../types";
import { ReminderSheet } from "../reminders/reminder-sheet";
import { SkipControl, SnoozeControl } from "./next-up-actions";

const DUE_TEXT: Record<string, string> = {
  destructive: "text-destructive",
  warning: "text-warning",
  info: "text-info",
  muted: "text-muted-foreground",
};

/** Edit for a custom reminder (RFE-164). Only a Task Hub task whose category is REMINDER gets it; other tasks stay as they were. */
function ReminderEditButton({ taskId, onEdit }: { taskId: string; onEdit: (task: Task) => void }) {
  const t = useTranslations("events.nextUp");
  const task = useReminderTask(taskId).data;
  if (task?.category !== "REMINDER") return null;
  return (
    <Button type="button" variant="outline" size="sm" className="h-11 sm:h-9" onClick={() => onEdit(task)}>
      {t("editReminder")}
    </Button>
  );
}

function NextUpCard({
  event,
  canRecord,
  canEditTask,
  onRecord,
  onEditReminder,
}: {
  event: UpcomingEvent;
  canRecord: boolean;
  canEditTask: boolean;
  onRecord: (key: EventKey, ref: string) => void;
  onEditReminder: (task: Task) => void;
}) {
  const t = useTranslations("events.nextUp");
  const text = useEventText(event);
  const Icon = KIND_ICON[event.kind];
  const recordKey = canRecord ? recordKeyFor(event) : null;
  const taskActions = canEditTask && canSnoozeSkip(event);

  return (
    <Card className="flex w-[85%] shrink-0 snap-start flex-col gap-2 rounded-xl p-3 sm:w-72">
      <div className="flex items-start gap-2">
        <Icon className={cn("mt-0.5 size-4 shrink-0", DUE_TEXT[text.variant])} aria-hidden />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-sm font-semibold leading-snug text-foreground break-words">{text.label}</span>
          <span className={cn("text-xs font-medium", DUE_TEXT[text.variant])}>
            {text.due}
            {text.date ? <span className="font-normal text-muted-foreground"> ({text.date})</span> : null}
          </span>
        </div>
      </div>
      {!event.actionable ? <p className="text-xs text-muted-foreground">{t("infoOnly")}</p> : null}
      {recordKey || taskActions ? (
        <div className="flex gap-2">
          {recordKey ? (
            <Button type="button" size="sm" className="h-11 flex-1 sm:h-9" onClick={() => onRecord(recordKey, event.ref.id)}>
              {t("record")}
            </Button>
          ) : null}
          {taskActions ? (
            <>
              <ReminderEditButton taskId={event.ref.id} onEdit={onEditReminder} />
              <SnoozeControl event={event} />
              <SkipControl event={event} />
            </>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

/**
 * "Next up" (RFE-160, 03 §3.2): everything due for this animal, most urgent first, as cards with the actions that apply —
 * Record (opens the matching form; the server closes the reminder when the event is saved), Snooze and Skip for Task
 * Hub reminders, nothing for information-only rows. A horizontal snap carousel on phones, a wrapping strip on desktop.
 */
export function NextUp({
  cattleId,
  animal,
  canRecord,
  onRecord,
}: {
  cattleId: string;
  /** For "Add reminder": the reminder starts on this animal. */
  animal?: ReminderAnimal;
  canRecord: boolean;
  onRecord: (key: EventKey, ref: string) => void;
}) {
  const t = useTranslations("events.nextUp");
  const can = useCan();
  const query = useUpcomingEvents(cattleId, true);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const events = query.data?.events ?? [];
  const hidden = (query.data?.total ?? 0) - events.length;

  return (
    <section aria-labelledby="next-up-heading" className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 id="next-up-heading" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {t("title")}
        </h2>
        {canRecord && can("task.create") ? (
          <Button type="button" variant="ghost" size="sm" className="h-11 gap-1 sm:h-8" onClick={() => setReminderOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t("addReminder")}
          </Button>
        ) : null}
      </div>
      {query.isLoading ? (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      ) : query.isError ? (
        <div className="flex items-center gap-2">
          <p className="text-sm text-destructive">{t("error")}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void query.refetch()}>
            {t("retry")}
          </Button>
        </div>
      ) : events.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("nothingDue")}</p>
      ) : (
        <div className="-mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
          {events.map((event) => (
            <NextUpCard
              key={`${event.ref.type}:${event.ref.id}:${event.labelKey}`}
              event={event}
              canRecord={canRecord}
              canEditTask={can("task.update")}
              onRecord={onRecord}
              onEditReminder={setEditing}
            />
          ))}
          {hidden > 0 ? <p className="shrink-0 self-center px-2 text-xs font-semibold text-muted-foreground">{t("more", { count: hidden })}</p> : null}
        </div>
      )}
      <ReminderSheet open={reminderOpen} onOpenChange={setReminderOpen} animal={animal} />
      <ReminderSheet key={editing?.id} open={editing !== null} onOpenChange={(open) => !open && setEditing(null)} task={editing ?? undefined} />
    </section>
  );
}
