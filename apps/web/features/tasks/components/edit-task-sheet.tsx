"use client"; // form state

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@rakhal/ui/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@rakhal/ui/ui/select";
import { Switch } from "@rakhal/ui/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@rakhal/ui/ui/button";
import { useUpdateTask } from "../hooks/use-tasks";
import { editTaskSchema, type EditTaskFormInput } from "../schemas";
import { CATEGORY_ORDER } from "../task-style";
import { editedDueAt, localDateOf } from "../due-date";
import { AssigneePicker } from "./assignee-picker";
import type { Task, TaskPriority, UpdateTaskPayload } from "../types";

const PRIORITIES: TaskPriority[] = ["HIGH", "MEDIUM", "LOW"];

const PRIORITY_TEXT: Record<TaskPriority, string> = {
  HIGH: "text-destructive",
  MEDIUM: "text-warning",
  LOW: "text-primary",
};
const PRIORITY_BORDER: Record<TaskPriority, string> = {
  HIGH: "border-destructive",
  MEDIUM: "border-warning",
  LOW: "border-primary",
};

function toDefaults(task: Task): EditTaskFormInput {
  return {
    name: task.name,
    details: task.details ?? undefined,
    category: task.category,
    priority: task.priority,
    dueAt: localDateOf(task.dueAt),
    assignedToId: task.assignedToId ?? undefined,
    safetyCritical: task.safetyCritical,
  };
}

function toPayload(values: EditTaskFormInput, original: Task): UpdateTaskPayload {
  return {
    name: values.name,
    details: values.details || undefined,
    category: values.category,
    priority: values.priority,
    dueAt: editedDueAt(original.dueAt, values.dueAt),
    assignedToId: values.assignedToId || undefined,
    safetyCritical: values.safetyCritical,
  };
}

/**
 * "Edit Task" (no ticket #, no Figma frame — `PATCH /tasks/:id` had a real route but no UI to
 * reach it). Same rounded-[20px] side-panel chrome as `CreateTaskSheet`, narrower field set —
 * recurrence/cow-target/steps aren't editable server-side today (`UpdateTaskDto`'s own shape).
 */
export function EditTaskSheet({
  task,
  open,
  onOpenChange,
  onUpdated,
}: {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: (task: Task) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open && task ? (
        <EditTaskSheetBody key={task.id} task={task} onOpenChange={onOpenChange} onUpdated={onUpdated} />
      ) : null}
    </Sheet>
  );
}

function EditTaskSheetBody({
  task,
  onOpenChange,
  onUpdated,
}: {
  task: Task;
  onOpenChange: (open: boolean) => void;
  onUpdated: (task: Task) => void;
}) {
  const t = useTranslations("tasks.editSheet");
  const tCreate = useTranslations("tasks.createSheet");
  const tCommon = useTranslations("tasks");
  const updateTask = useUpdateTask();

  const form = useForm<EditTaskFormInput>({
    resolver: zodResolver(editTaskSchema),
    defaultValues: toDefaults(task),
  });

  async function onSubmit(values: EditTaskFormInput) {
    try {
      const updated = await updateTask.mutateAsync({ id: task.id, dto: toPayload(values, task) });
      toast.success(t("updatedToast"));
      onUpdated(updated);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : tCreate("genericError"));
    }
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-[560px] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
    >
      <div className="flex items-start justify-between pb-6">
        <div className="flex items-center gap-1.5">
          <Pencil className="size-6 text-foreground" aria-hidden />
          <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={tCreate("close")}
          className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-5">
          <LabeledInput
            id="edit-name"
            label={tCreate("taskName")}
            placeholder={tCreate("taskNamePlaceholder")}
            {...form.register("name")}
            error={form.formState.errors.name?.message}
          />

          <div className="w-full">
            <div className="flex items-start gap-2.5 rounded-xl border border-input bg-card px-4 pb-2.5 pt-4 shadow-xs focus-within:ring-2 focus-within:ring-ring">
              <div className="flex min-w-0 flex-1 flex-col">
                <label htmlFor="edit-details" className="text-xs text-muted-foreground">
                  {tCreate("taskDetails")}
                </label>
                <textarea
                  id="edit-details"
                  rows={3}
                  placeholder={tCreate("taskDetailsPlaceholder")}
                  className="w-full resize-none border-0 bg-transparent p-0 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  {...form.register("details")}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-5">
            <Controller
              control={form.control}
              name="category"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <LabeledSelectTrigger label={tCreate("category")} placeholder={tCreate("selectCategory")} />
                  <SelectContent>
                    {CATEGORY_ORDER.map((c) => (
                      <SelectItem key={c} value={c}>
                        {tCommon(`category.${c}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <Controller
              control={form.control}
              name="dueAt"
              render={({ field }) => (
                <DatePicker
                  label={tCreate("dueDate")}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={tCreate("dueDatePlaceholder")}
                  error={form.formState.errors.dueAt?.message}
                />
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-foreground">{tCreate("taskPriority")}</p>
            <Controller
              control={form.control}
              name="priority"
              render={({ field }) => (
                <div className="flex items-center gap-2">
                  {PRIORITIES.map((priority) => (
                    <button
                      key={priority}
                      type="button"
                      onClick={() => field.onChange(priority)}
                      className={cn(
                        "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg border bg-card px-4 py-1.5 text-sm font-bold transition-colors",
                        PRIORITY_TEXT[priority],
                        field.value === priority ? PRIORITY_BORDER[priority] : "border-input",
                      )}
                    >
                      {tCommon(`priority.${priority}`)}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <Controller
            control={form.control}
            name="assignedToId"
            render={({ field }) => (
              <AssigneePicker value={field.value} onValueChange={(id) => field.onChange(id)} />
            )}
          />

          <div className="flex items-center gap-10 rounded-xl border border-border bg-muted p-3">
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-bold text-foreground">{tCreate("safetyCritical")}</p>
              <p className="text-xs text-muted-foreground">{tCreate("safetyCriticalDesc")}</p>
            </div>
            <Controller
              control={form.control}
              name="safetyCritical"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-2 pt-5">
          <Button type="button" variant="secondary" className="h-[52px] flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={updateTask.isPending}>
            {tCreate("cancel")}
          </Button>
          <Button type="submit" className="h-[52px] flex-1 rounded-xl" disabled={updateTask.isPending}>
            {updateTask.isPending ? "…" : t("save")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
