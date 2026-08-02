"use client"; // reassign popover + step-check mutations

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Chip } from "@/components/ui/chip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useCheckTaskStep, useCompleteTask, useUpdateTask } from "../hooks/use-tasks";
import { avatarTint, initials } from "../avatar-tint";
import { PRIORITY_CHIP_VARIANT } from "../task-style";
import { AssigneePicker } from "./assignee-picker";
import type { Task } from "../types";

function InfoTile({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 w-full">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

/**
 * "Task Details" (Figma 1039:48730) — mirrors `GET /tasks/:id`'s presented shape. "Reassign" has no
 * Figma frame of its own — a minimal inline `AssigneePicker` popover is used instead of a dead
 * button (same "flag the gap, build the smallest real affordance" precedent as several other tickets
 * on this board), calling the real `PATCH /tasks/:id`. A checklist section (checkable steps via
 * `POST /tasks/:id/steps/:stepId/check`) is shown below the description when the task has any steps
 * — the mock only shows a "Steps Completed 1/4" *count*, not the list itself, but PRD §17 explicitly
 * calls for checkable steps in this view and the count with no way to check them would be dead too.
 */
export function TaskDetailsSheet({ task, open, onOpenChange }: { task: Task | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && task ? <TaskDetailsSheetBody key={task.id} task={task} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function TaskDetailsSheetBody({ task: initialTask, onOpenChange }: { task: Task; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("tasks.detailsSheet");
  const tCommon = useTranslations("tasks");
  const locale = useLocale() as Locale;
  const [reassigning, setReassigning] = useState(false);
  // Local copy kept in sync with mutation responses so Reassign/step-check reflect immediately in
  // this open sheet, instead of only after the underlying list refetches and it's reopened.
  const [task, setTask] = useState(initialTask);

  const completeTask = useCompleteTask();
  const updateTask = useUpdateTask();
  const checkStep = useCheckTaskStep();

  const isCompleted = task.displayStatus === "completed";

  async function handleComplete() {
    try {
      const updated = await completeTask.mutateAsync({ id: task.id, dto: {} });
      setTask(updated);
      toast.success(t("completedToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handleReassign(userId: string) {
    try {
      const updated = await updateTask.mutateAsync({ id: task.id, dto: { assignedToId: userId } });
      setTask(updated);
      toast.success(t("reassignedToast"));
      setReassigning(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const dueLabel =
    task.displayStatus === "overdue" && task.overdueByHours !== null
      ? t("overdueBy", { hours: task.overdueByHours })
      : formatDate(task.dueAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

  return (
    <SheetContent
      showClose={false}
      className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-[560px] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
    >
      <div className="flex flex-col gap-5 pb-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-xs font-bold text-muted-foreground">{task.reference}</p>
            <SheetTitle className="text-xl font-bold text-foreground">{task.name}</SheetTitle>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            aria-label={t("close")}
            className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
          >
            <ArrowRightToLine className="size-5" aria-hidden />
          </button>
        </div>
        <div className="border-t border-dashed border-border" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto">
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 sm:grid sm:grid-cols-2 sm:gap-x-10 sm:gap-y-5">
          <InfoTile label={t("dueDate")}>
            <Chip variant={task.displayStatus === "overdue" ? "destructive" : "muted"} className="w-fit">
              {dueLabel}
            </Chip>
          </InfoTile>
          <InfoTile label={t("taskPriority")}>
            <Chip variant={PRIORITY_CHIP_VARIANT[task.priority]} subtle className="w-fit">
              {tCommon(`priority.${task.priority}`)}
            </Chip>
          </InfoTile>
          <InfoTile label={t("category")}>
            <p className="text-sm font-bold text-foreground">{tCommon(`category.${task.category}`)}</p>
          </InfoTile>
          <InfoTile label={t("recurrence")}>
            <p className="text-sm font-bold text-foreground">
              {task.recurring && task.recurrenceType ? tCommon(`recurrence.${task.recurrenceType}`) : t("oneOff")}
            </p>
          </InfoTile>
          <InfoTile label={t("stepsCompleted")}>
            <p className="text-sm font-bold text-foreground">{task.stepsTotal > 0 ? `${task.stepsCompleted}/${task.stepsTotal}` : "—"}</p>
          </InfoTile>
          <InfoTile label={t("assignTo")}>
            {task.assignedTo ? (
              <div className="flex items-center gap-1.5">
                <Avatar className="size-5">
                  <AvatarFallback className={cn("text-[10px]", avatarTint(task.assignedTo.id))}>{initials(task.assignedTo.name)}</AvatarFallback>
                </Avatar>
                <p className="text-sm font-bold text-foreground">{task.assignedTo.name}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("unassigned")}</p>
            )}
          </InfoTile>
        </div>

        {task.details ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-muted-foreground">{t("description")}</p>
            <p className="text-sm text-foreground">{task.details}</p>
          </div>
        ) : null}

        {task.steps.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-muted-foreground">{t("checklist")}</p>
            <div className="flex flex-col gap-2">
              {task.steps.map((step) => (
                <label key={step.id} className="flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2.5">
                  <Checkbox
                    checked={step.completed}
                    disabled={checkStep.isPending || isCompleted}
                    onCheckedChange={(checked) =>
                      checkStep.mutate(
                        { id: task.id, stepId: step.id, completed: checked === true },
                        { onSuccess: setTask },
                      )
                    }
                  />
                  <span className={cn("text-sm text-foreground", step.completed && "text-muted-foreground line-through")}>{step.text}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        {reassigning ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-3">
            <p className="text-xs font-medium text-foreground">{t("reassignTo")}</p>
            <AssigneePicker value={task.assignedToId ?? undefined} onValueChange={(userId) => void handleReassign(userId)} disabled={updateTask.isPending} />
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 pt-5">
        <div className="border-t border-dashed border-border" />
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            className="h-[52px] flex-1 rounded-xl"
            onClick={() => setReassigning((v) => !v)}
            disabled={updateTask.isPending}
          >
            {t("reassign")}
          </Button>
          <Button
            type="button"
            className="h-[52px] flex-1 rounded-xl"
            onClick={() => void handleComplete()}
            disabled={isCompleted || completeTask.isPending}
          >
            {isCompleted ? (
              <>
                <Check className="size-4" aria-hidden />
                {t("completed")}
              </>
            ) : completeTask.isPending ? (
              "…"
            ) : (
              t("markComplete")
            )}
          </Button>
        </div>
      </div>
    </SheetContent>
  );
}
