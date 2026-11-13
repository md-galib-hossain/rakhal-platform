"use client"; // dialog + form state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Chip } from "@rakhal/ui/ui/chip";
import { Button } from "@rakhal/ui/ui/button";
import { useRescheduleTask } from "../hooks/use-health";
import { groupIncompleteTasks, taskCategoryChip, type ScheduledTaskGroup } from "../task-grouping";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@rakhal/ui/ui/label";

/**
 * "Task Reschedule" — Figma 734:44187 (`get_design_context`): current date → new date, Cancel/Confirm.
 * Reschedules every *incomplete* task in the group (not the whole card — an animal whose dose is
 * already logged shouldn't be bumped), looping the real per-task `POST /health/tasks/:id/reschedule`
 * since there's no batch-reschedule endpoint.
 */
export function TaskRescheduleDialog({ group, onOpenChange }: { group: ScheduledTaskGroup | undefined; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={Boolean(group)} onOpenChange={onOpenChange}>
      {group ? <TaskRescheduleDialogBody key={group.key} group={group} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function TaskRescheduleDialogBody({ group, onOpenChange }: { group: ScheduledTaskGroup; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("health.taskHub.reschedule");
  const reschedule = useRescheduleTask();
  const currentDate = group.dueDateTime.slice(0, 10);
  const [newDate, setNewDate] = useState(currentDate);
  const category = taskCategoryChip(group.taskType);
  const incomplete = groupIncompleteTasks(group);

  async function handleConfirm() {
    if (!newDate || newDate === currentDate) {
      toast.error(t("noChangeError"));
      return;
    }
    try {
      await Promise.all(
        incomplete.map((task) => reschedule.mutateAsync({ id: task.id, dto: { newDueDateTime: new Date(newDate).toISOString() } })),
      );
      toast.success(t("rescheduledToast", { count: incomplete.length }));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent showClose side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-[520px] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t("title")}</p>
        <div className="flex items-center gap-2">
          <SheetTitle className="text-xl font-bold text-foreground">{group.title}</SheetTitle>
          <Chip variant={category.variant}>{t(`category.${category.labelKey}`)}</Chip>
        </div>
      </div>
      <div className="border-t border-dashed border-border" />

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <div className="flex flex-col gap-1.5">
            <Label>{t("currentDate")}</Label>
            {/* Read-only "from" side of the reschedule — a disabled native date input rendered the
                browser's own picker chrome next to the themed one, so it's plain text now. */}
            <p className="flex h-11 items-center rounded-md border border-input bg-muted px-3.5 text-sm text-muted-foreground">
              {currentDate}
            </p>
          </div>
        </div>
        <ArrowLeftRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex-1">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="newDate">{t("newDate")}</Label>
            <DatePicker id="newDate" label={t("newDate")} value={newDate} onChange={setNewDate} />
          </div>
        </div>
      </div>

      <div className="border-t border-dashed border-border" />
      <div className="flex gap-2">
        <Button type="button" variant="secondary" className="h-[52px] flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={reschedule.isPending}>
          {t("cancel")}
        </Button>
        <Button type="button" className="h-[52px] flex-1 rounded-xl" onClick={handleConfirm} disabled={reschedule.isPending}>
          {reschedule.isPending ? "…" : t("confirm")}
        </Button>
      </div>
    </SheetContent>
  );
}
