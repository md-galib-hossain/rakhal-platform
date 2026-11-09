"use client"; // reassign popover + mutations

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, BellPlus, Check, Pencil, RotateCcw, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { TaskChip } from "./task-chip";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useCancelTask, useCompleteTask, useDeleteTask, useReopenTask, useUpdateTask } from "../hooks/use-tasks";
import { avatarTint, initials } from "../avatar-tint";
import { DISPLAY_STATUS_CHIP_VARIANT, PRIORITY_CHIP_VARIANT } from "../task-style";
import { LACTATION_ALERT_ICON, lactationAlertSeverity, parseLactationAlert } from "../lactation-alert";
import { openRemindMe } from "@/features/notifications/sheet-store";
import { AssigneePicker } from "./assignee-picker";
import { EditTaskSheet } from "./edit-task-sheet";
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
 * on this board), calling the real `PATCH /tasks/:id`. Checklist sub-steps were removed (user
 * decision, no ticket #) — `Task` no longer has a `steps` field at all.
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
  const tGlobal = useTranslations("common");
  const locale = useLocale() as Locale;
  const [reassigning, setReassigning] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelNote, setCancelNote] = useState("");
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // Local copy kept in sync with mutation responses so Reassign reflects immediately in this open
  // sheet, instead of only after the underlying list refetches and it's reopened.
  const [task, setTask] = useState(initialTask);

  const completeTask = useCompleteTask();
  const reopenTask = useReopenTask();
  const updateTask = useUpdateTask();
  const cancelTask = useCancelTask();
  const deleteTask = useDeleteTask();

  const isCompleted = task.displayStatus === "completed";
  const isCancelled = task.displayStatus === "cancelled";
  const isClosed = isCompleted || isCancelled;

  /** NV2: "remind me" is a notification anchored to this task, composed in the notification sheet (not a Task row). */
  function handleRemindMe() {
    onOpenChange(false);
    openRemindMe({ anchor: { type: "TASK", id: task.id, label: task.name } });
  }

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

  /** Undo a mistaken complete — keeps the sheet open so the reopened state is visible. */
  async function handleReopen() {
    try {
      const updated = await reopenTask.mutateAsync(task.id);
      setTask(updated);
      toast.success(t("reopenedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  /** User-initiated abandonment (RAKHAL-405) — distinct from `handleComplete`. 400 from the backend
   * if already COMPLETED/CANCELLED, guarded here too by only rendering the button when live. */
  async function handleCancel() {
    try {
      const updated = await cancelTask.mutateAsync({ id: task.id, dto: { notes: cancelNote.trim() || undefined } });
      setTask(updated);
      toast.success(t("cancelledToast"));
      setCancelling(false);
      setCancelNote("");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  /** Real `DELETE /tasks/:id` route (`task.delete`-gated) that had no UI before this — closes the
   * sheet on success, `useDeleteTask`'s own `onSuccess` already invalidates the list query. */
  async function handleDelete() {
    try {
      await deleteTask.mutateAsync(task.id);
      toast.success(t("deletedToast"));
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

  // See task-card.tsx — strips the backend's `[LACTATION_ALERT:<TAG>]` dedupe marker off
  // `details` and surfaces a type-specific chip instead of the raw bracket.
  const lactationAlert = parseLactationAlert(task.details);
  const LactationIcon = lactationAlert ? LACTATION_ALERT_ICON[lactationAlert.kind] : null;
  const visibleDetails = lactationAlert ? lactationAlert.cleanDetails : task.details;

  return (
    <SheetContent
      showClose={false}
      className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-[560px] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
    >
      <div className="flex flex-col gap-5 pb-5">
        <div className="flex items-start justify-between">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <p className="text-xs font-bold text-muted-foreground">{task.reference}</p>
              <TaskChip variant={DISPLAY_STATUS_CHIP_VARIANT[task.displayStatus]} subtle className="w-fit">
                {tCommon(`status.${task.displayStatus}`)}
              </TaskChip>
            </div>
            {lactationAlert && LactationIcon ? (
              <TaskChip variant={lactationAlertSeverity(lactationAlert.kind)} subtle className="w-fit gap-1.5">
                <LactationIcon className="size-3.5" aria-hidden />
                {tCommon(`lactationAlert.${lactationAlert.kind}`)}
              </TaskChip>
            ) : null}
            <SheetTitle className={cn("text-xl font-bold text-foreground", isClosed && "line-through")}>{task.name}</SheetTitle>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {!isClosed ? (
              <Can I="notification.create">
                <button
                  type="button"
                  onClick={handleRemindMe}
                  aria-label={t("remindMe")}
                  title={t("remindMe")}
                  className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
                >
                  <BellPlus className="size-5" aria-hidden />
                </button>
              </Can>
            ) : null}
            <Can I="task.update">
              <button
                type="button"
                onClick={() => setEditing(true)}
                aria-label={t("edit")}
                className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
              >
                <Pencil className="size-5" aria-hidden />
              </button>
            </Can>
            <Can I="task.delete">
              <button
                type="button"
                onClick={() => setDeleting(true)}
                aria-label={t("delete")}
                className="flex size-5 items-center justify-center text-destructive transition-opacity hover:opacity-70"
              >
                <Trash2 className="size-5" aria-hidden />
              </button>
            </Can>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t("close")}
              className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
            >
              <ArrowRightToLine className="size-5" aria-hidden />
            </button>
          </div>
        </div>
        <div className="border-t border-dashed border-border" />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1">
        <div className="flex flex-col gap-5 rounded-xl border border-border bg-card p-4 sm:grid sm:grid-cols-2 sm:gap-x-10 sm:gap-y-5">
          <InfoTile label={t("dueDate")}>
            <TaskChip variant={task.displayStatus === "overdue" ? "destructive" : "muted"} className="w-fit">
              {dueLabel}
            </TaskChip>
          </InfoTile>
          <InfoTile label={t("taskPriority")}>
            <TaskChip variant={PRIORITY_CHIP_VARIANT[task.priority]} subtle className="w-fit">
              {tCommon(`priority.${task.priority}`)}
            </TaskChip>
          </InfoTile>
          <InfoTile label={t("category")}>
            <p className="text-sm font-bold text-foreground">{tCommon(`category.${task.category}`)}</p>
          </InfoTile>
          {task.relatedCattle || task.cattleTags.length > 0 ? (
            <InfoTile label={t("cow")}>
              {task.relatedCattle ? (
                <p className="text-sm font-bold text-foreground">
                  {task.relatedCattle.name
                    ? `${task.relatedCattle.tagNumber} — ${task.relatedCattle.name}`
                    : task.relatedCattle.tagNumber}
                </p>
              ) : (
                <p className="text-sm font-bold text-foreground">
                  {task.cattleTags
                    .map((c) => (c.name ? `${c.tagNumber} — ${c.name}` : c.tagNumber))
                    .join(", ")}
                </p>
              )}
            </InfoTile>
          ) : null}
          <InfoTile label={t("recurrence")}>
            <p className="text-sm font-bold text-foreground">
              {task.recurring && task.recurrenceType ? tCommon(`recurrence.${task.recurrenceType}`) : t("oneOff")}
            </p>
          </InfoTile>
          <InfoTile label={t("assignTo")}>
            {task.assignedTo ? (
              <div className="flex items-center gap-1.5">
                <Avatar className="size-5">
                  <AvatarFallback className={cn("text-xs", avatarTint(task.assignedTo.id))}>{initials(task.assignedTo.name)}</AvatarFallback>
                </Avatar>
                <p className="text-sm font-bold text-foreground">{task.assignedTo.name}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">{t("unassigned")}</p>
            )}
          </InfoTile>
        </div>

        {isCompleted && task.completedAt ? (
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t("completedAt", { date: formatDate(task.completedAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) })}
            </p>
            {task.completionNote ? <p className="text-sm text-foreground">{task.completionNote}</p> : null}
          </div>
        ) : null}

        {isCancelled && task.cancelledAt ? (
          <div className="flex flex-col gap-1 rounded-xl border border-border bg-muted p-3">
            <p className="text-xs font-medium text-muted-foreground">
              {t("cancelledAt", { date: formatDate(task.cancelledAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) })}
            </p>
            {task.completionNote ? <p className="text-sm text-foreground">{task.completionNote}</p> : null}
          </div>
        ) : null}

        {visibleDetails ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-muted-foreground">{t("description")}</p>
            <p className="text-sm text-foreground">{visibleDetails}</p>
          </div>
        ) : null}

        {task.history.length > 0 ? (
          <div className="flex flex-col gap-3">
            <p className="text-xs font-medium text-muted-foreground">{t("activity")}</p>
            <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3">
              {task.history.map((h, i) => (
                <div key={h.id} className={cn("flex flex-col gap-0.5 pb-2", i < task.history.length - 1 && "border-b border-dashed border-border")}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-foreground">
                      {t(`historyAction.${h.action}`)}
                      {h.actorName ? ` — ${h.actorName}` : ""}
                    </p>
                    <p className="shrink-0 text-xs text-muted-foreground">
                      {formatDate(h.createdAt, locale, { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                  {h.note ? <p className="text-sm text-muted-foreground">{h.note}</p> : null}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {reassigning && !isCancelled ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-3">
            <p className="text-xs font-medium text-foreground">{t("reassignTo")}</p>
            <AssigneePicker value={task.assignedToId ?? undefined} onValueChange={(userId) => void handleReassign(userId)} disabled={updateTask.isPending} />
          </div>
        ) : null}

        {cancelling ? (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-muted p-3">
            <p className="text-xs font-medium text-foreground">{t("cancelReason")}</p>
            <textarea
              value={cancelNote}
              onChange={(e) => setCancelNote(e.target.value)}
              placeholder={t("cancelReasonPlaceholder")}
              rows={2}
              className="w-full resize-none rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <div className="flex items-center gap-2">
              <Button type="button" variant="secondary" className="flex-1" onClick={() => { setCancelling(false); setCancelNote(""); }} disabled={cancelTask.isPending}>
                {t("cancelReasonBack")}
              </Button>
              <Button type="button" variant="destructive" className="flex-1" onClick={() => void handleCancel()} disabled={cancelTask.isPending}>
                {cancelTask.isPending ? "…" : t("cancelReasonConfirm")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-5 pt-5">
        <div className="border-t border-dashed border-border" />
        <div className="flex flex-wrap items-center gap-2">
          {!isCancelled ? (
            <Can I="task.update">
              <Button
                type="button"
                variant="secondary"
                className="h-[52px] min-w-[8.5rem] flex-1 rounded-xl"
                onClick={() => setReassigning((v) => !v)}
                disabled={updateTask.isPending}
              >
                {t("reassign")}
              </Button>
            </Can>
          ) : null}
          {isCompleted ? (
            <Can I="task.update">
              <Button
                type="button"
                variant="secondary"
                className="h-[52px] min-w-[8.5rem] flex-1 rounded-xl"
                onClick={() => void handleReopen()}
                disabled={reopenTask.isPending}
              >
                <RotateCcw className="size-4" aria-hidden />
                {reopenTask.isPending ? "…" : t("reopen")}
              </Button>
            </Can>
          ) : null}
          {!isClosed ? (
            <Can I="task.update">
              <Button
                type="button"
                variant="secondary"
                className="h-[52px] min-w-[8.5rem] flex-1 rounded-xl"
                onClick={() => setCancelling((v) => !v)}
                disabled={cancelTask.isPending}
              >
                <X className="size-4" aria-hidden />
                {t("cancelTask")}
              </Button>
            </Can>
          ) : null}
          <Can I="task.complete">
          <Button
            type="button"
            className="h-[52px] min-w-[8.5rem] flex-1 rounded-xl"
            onClick={() => void handleComplete()}
            disabled={isClosed || completeTask.isPending}
          >
            {isCompleted ? (
              <>
                <Check className="size-4" aria-hidden />
                {t("completed")}
              </>
            ) : isCancelled ? (
              t("cancelled")
            ) : completeTask.isPending ? (
              "…"
            ) : (
              t("markComplete")
            )}
          </Button>
          </Can>
        </div>
      </div>

      <EditTaskSheet task={editing ? task : null} open={editing} onOpenChange={setEditing} onUpdated={setTask} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={t("deleteConfirmTitle")}
        description={t("deleteConfirmDescription")}
        confirmLabel={t("delete")}
        cancelLabel={tGlobal("cancel")}
        onConfirm={handleDelete}
      />
    </SheetContent>
  );
}
