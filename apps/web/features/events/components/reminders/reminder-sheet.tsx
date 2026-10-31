"use client"; // react-hook-form state, mutations, sheet open state

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlarmClock, ArrowRightToLine } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { useSession } from "@/lib/auth/use-session";
import { todayLocalIso } from "@/lib/local-date";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import type { Task } from "@/features/tasks/types";
import {
  buildCreatePayload,
  buildUpdatePayload,
  defaultReminderValues,
  reminderSchema,
  valuesFromTask,
  type ReminderAnimal,
  type ReminderFormValues,
} from "../../reminders/reminder-model";
import { useCancelReminder, useCreateReminder, useUpdateReminder } from "../../reminders/use-reminders";
import { AnimalsSection, AudienceSection, RepeatSection, TitleAndNotes, WhenSection } from "./reminder-sections";

/** Bottom sheet below 640px (03 §8.1 "Phone: bottom sheet, same order"), the app's inset right-hand panel from there up. */
const SHEET_CLASS =
  "inset-x-0 bottom-0 top-auto flex max-h-[92dvh] w-full flex-col gap-0 rounded-t-[20px] border-0 p-4 pb-0 shadow-2xl sm:inset-y-2.5 sm:left-auto sm:right-2.5 sm:bottom-auto sm:h-[calc(100vh-20px)] sm:max-h-none sm:max-w-[560px] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:pb-5";

/**
 * Custom reminder form (RFE-164, 03 §8.1) — create, or edit when `task` is given. A reminder is a Task Hub task with
 * `category: "REMINDER"`; Next up and the Task Hub list it from there. `animal` pre-fills the workspace's animal.
 */
export function ReminderSheet({
  open,
  onOpenChange,
  animal,
  task,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  animal?: ReminderAnimal;
  task?: Task;
  /** Edit only: the task as saved, so a caller that shows it (Task Hub details) can refresh without a refetch. */
  onSaved?: (task: Task) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <ReminderSheetBody onOpenChange={onOpenChange} animal={animal} task={task} onSaved={onSaved} /> : null}
    </Sheet>
  );
}

function ReminderSheetBody({
  onOpenChange,
  animal,
  task,
  onSaved,
}: {
  onOpenChange: (open: boolean) => void;
  animal?: ReminderAnimal;
  task?: Task;
  onSaved?: (task: Task) => void;
}) {
  const t = useTranslations("events.reminders");
  const { data: session } = useSession();
  const editing = Boolean(task);
  const create = useCreateReminder();
  const update = useUpdateReminder();
  const cancel = useCancelReminder();
  const [confirmCancel, setConfirmCancel] = useState(false);

  const form = useForm<ReminderFormValues>({
    resolver: zodResolver(reminderSchema),
    defaultValues: task ? valuesFromTask(task) : defaultReminderValues({ today: todayLocalIso(), assigneeId: session?.user.id, animal }),
  });
  const { control, register, setValue, formState } = form;

  // "Me" is the default assignee; the session can arrive after the sheet opened.
  const me = session?.user.id;
  useEffect(() => {
    if (!editing && me && !form.getValues("assigneeId")) setValue("assigneeId", me);
  }, [editing, me, form, setValue]);

  const pending = create.isPending || update.isPending || cancel.isPending;
  const sectionProps = { control, register, setValue, errors: formState.errors, editing };

  async function onSubmit(values: ReminderFormValues) {
    try {
      if (task) {
        const saved = await update.mutateAsync({ id: task.id, dto: buildUpdatePayload(values, task) });
        onSaved?.(saved);
        toast.success(t("updatedToast"));
      } else {
        await create.mutateAsync(buildCreatePayload(values));
        toast.success(t("createdToast"));
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function onCancelReminder() {
    if (!task) return;
    try {
      await cancel.mutateAsync({ id: task.id });
      toast.success(t("cancelledToast"));
      setConfirmCancel(false);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const heading = task ? t("editTitle") : animal ? t("titleFor", { animal: animal.name ?? animal.tagNumber }) : t("title");

  return (
    <SheetContent showClose={false} side="bottom" className={SHEET_CLASS}>
      <div className="flex items-start justify-between pb-4">
        <div className="flex items-center gap-1.5">
          <AlarmClock className="size-6 text-foreground" aria-hidden />
          <SheetTitle className="text-xl font-bold text-foreground">{heading}</SheetTitle>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("close")}
          className="flex size-11 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70 sm:size-5"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <SheetDescription className="sr-only">{t("description")}</SheetDescription>
      <div className="border-t border-dashed border-border" />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-4">
          <TitleAndNotes register={register} errors={formState.errors} />
          <WhenSection {...sectionProps} />
          <RepeatSection {...sectionProps} />
          <AudienceSection {...sectionProps} />
          <AnimalsSection {...sectionProps} />
          {task ? (
            <Button type="button" variant="ghost" className="h-11 self-start text-destructive hover:text-destructive" onClick={() => setConfirmCancel(true)} disabled={pending}>
              {t("cancelReminder")}
            </Button>
          ) : null}
        </div>
        <div className="border-t border-dashed border-border" />
        <div className="flex gap-2 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0">
          <Button type="button" variant="secondary" className="h-12 flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1 rounded-xl" disabled={pending}>
            {pending ? t("saving") : t("save")}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirmCancel}
        onOpenChange={setConfirmCancel}
        title={t("cancelConfirmTitle")}
        description={t("cancelConfirmBody")}
        confirmLabel={t("cancelConfirmAction")}
        cancelLabel={t("keep")}
        onConfirm={onCancelReminder}
      />
    </SheetContent>
  );
}
