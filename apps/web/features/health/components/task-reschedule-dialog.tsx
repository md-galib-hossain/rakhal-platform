"use client"; // dialog + form state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowLeftRight } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import { useRescheduleTask } from "../hooks/use-health";
import { groupIncompleteTasks, taskCategoryChip, type ScheduledTaskGroup } from "../task-grouping";

/**
 * "Task Reschedule" — Figma 734:44187 (`get_design_context`): current date → new date, Cancel/Confirm.
 * Reschedules every *incomplete* task in the group (not the whole card — an animal whose dose is
 * already logged shouldn't be bumped), looping the real per-task `POST /health/tasks/:id/reschedule`
 * since there's no batch-reschedule endpoint.
 */
export function TaskRescheduleDialog({ group, onOpenChange }: { group: ScheduledTaskGroup | undefined; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={Boolean(group)} onOpenChange={onOpenChange}>
      {group ? <TaskRescheduleDialogBody key={group.key} group={group} onOpenChange={onOpenChange} /> : null}
    </Dialog>
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
    <DialogContent showClose className="max-w-[520px] rounded-[20px] border-2 border-border p-5">
      <div className="flex flex-col gap-2">
        <p className="text-sm text-muted-foreground">{t("title")}</p>
        <div className="flex items-center gap-2">
          <DialogTitle className="text-xl font-bold text-foreground">{group.title}</DialogTitle>
          <Chip variant={category.variant}>{t(`category.${category.labelKey}`)}</Chip>
        </div>
      </div>
      <div className="border-t border-dashed border-border" />

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <LabeledInput id="currentDate" type="date" label={t("currentDate")} value={currentDate} readOnly disabled />
        </div>
        <ArrowLeftRight className="size-6 shrink-0 text-muted-foreground" aria-hidden />
        <div className="flex-1">
          <LabeledInput id="newDate" type="date" label={t("newDate")} value={newDate} onChange={(e) => setNewDate(e.target.value)} />
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
    </DialogContent>
  );
}
