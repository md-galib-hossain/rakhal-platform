"use client"; // form state

import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, ClipboardList, Tag, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@rakhal/ui/ui/select";
import { Switch } from "@rakhal/ui/ui/switch";
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@rakhal/ui/ui/button";
import { CattleMultiPicker, type CattleOption } from "@/components/shared/cattle-picker";
import { cattleApi } from "@/features/cattle/api";
import { useCreateTask } from "../hooks/use-tasks";
import { createTaskSchema, type CreateTaskFormInput } from "../schemas";
import { CATEGORY_ORDER } from "../task-style";
import { AssigneePicker } from "./assignee-picker";
import type { CreateTaskPayload, TaskPriority } from "../types";

const PRIORITIES: TaskPriority[] = ["HIGH", "MEDIUM", "LOW"];
const RECURRENCE_TYPES = ["DAILY", "WEEKLY", "MONTHLY"] as const;

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

function toPayload(
  values: CreateTaskFormInput,
  defaultCattleId?: string,
  cattleIds?: string[],
): CreateTaskPayload {
  return {
    name: values.name,
    details: values.details || undefined,
    category: values.category,
    priority: values.priority,
    dueAt: new Date(`${values.dueAt}T09:00:00`).toISOString(),
    assignedToId: values.assignedToId || undefined,
    recurring: values.recurring,
    recurrenceType: values.recurring ? values.recurrenceType : undefined,
    safetyCritical: values.safetyCritical,
    relatedCattleId: cattleIds?.length ? undefined : defaultCattleId,
    cattleIds: cattleIds?.length ? cattleIds : undefined,
  };
}

/**
 * "Create New Task" (Figma 1039:48550) — mirrors `CreateTaskDto` exactly. Same rounded-[20px]
 * side-panel chrome as `CreateHealthPlanDialog` (dashed section rules, `ArrowRightToLine` close
 * glyph). Multi-cow targeting (user request, no ticket #) has no Figma frame — a minimal
 * `CattleMultiPicker`-add/remove-chip section, same "flag the gap, build the smallest real
 * affordance" precedent this file's own Reassign field already sets; the picker itself supports
 * selecting and unselecting several cows in one open popover (checkbox semantics), not just one pick
 * per open. Opened with a `defaultCattleId` (animal-profile Tasks tab) skips the picker entirely and
 * shows a read-only "Target Cow" chip instead, so the pre-fill that already lands in
 * `CreateTaskDto.relatedCattleId` on submit is visibly confirmed rather than silently applied.
 */
export function CreateTaskSheet({
  open,
  onOpenChange,
  defaultCattleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Per-animal Task Hub view (unified animal-profile redesign, no ticket #) — pre-fills
   * `CreateTaskDto.relatedCattleId` when created from an animal's own Tasks tab. */
  defaultCattleId?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <CreateTaskSheetBody onOpenChange={onOpenChange} defaultCattleId={defaultCattleId} /> : null}
    </Sheet>
  );
}

function CreateTaskSheetBody({
  onOpenChange,
  defaultCattleId,
}: {
  onOpenChange: (open: boolean) => void;
  defaultCattleId?: string;
}) {
  const t = useTranslations("tasks.createSheet");
  const tCommon = useTranslations("tasks");
  const createTask = useCreateTask();
  const [cattle, setCattle] = useState<CattleOption[]>([]);

  const { data: defaultCattle } = useQuery({
    queryKey: ["cattle-picker-selected", defaultCattleId],
    queryFn: () => cattleApi.findOne(defaultCattleId as string),
    enabled: Boolean(defaultCattleId),
    staleTime: 30_000,
  });

  const form = useForm<CreateTaskFormInput>({
    resolver: zodResolver(createTaskSchema),
    defaultValues: { priority: "HIGH", recurring: false, safetyCritical: false },
  });

  async function onSubmit(values: CreateTaskFormInput) {
    try {
      await createTask.mutateAsync(
        toPayload(values, defaultCattleId, cattle.map((c) => c.id)),
      );
      toast.success(t("createdToast"));
      form.reset({ priority: "HIGH", recurring: false, safetyCritical: false });
      setCattle([]);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const recurring = form.watch("recurring");

  return (
    <SheetContent
      showClose={false}
      className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-[560px] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
    >
      <div className="flex items-start justify-between pb-6">
        <div className="flex items-center gap-1.5">
          <ClipboardList className="size-6 text-foreground" aria-hidden />
          <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
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

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-5">
          <LabeledInput
            id="name"
            label={t("taskName")}
            placeholder={t("taskNamePlaceholder")}
            {...form.register("name")}
            error={form.formState.errors.name?.message}
          />

          <div className="w-full">
            <div className="flex items-start gap-2.5 rounded-xl border border-input bg-card px-4 pb-2.5 pt-4 shadow-xs focus-within:ring-2 focus-within:ring-ring">
              <div className="flex min-w-0 flex-1 flex-col">
                <label htmlFor="details" className="text-xs text-muted-foreground">
                  {t("taskDetails")}
                </label>
                <textarea
                  id="details"
                  rows={3}
                  placeholder={t("taskDetailsPlaceholder")}
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
                  <LabeledSelectTrigger label={t("category")} placeholder={t("selectCategory")} />
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
                  label={t("dueDate")}
                  value={field.value}
                  onChange={field.onChange}
                  placeholder={t("dueDatePlaceholder")}
                  error={form.formState.errors.dueAt?.message}
                  disabledDates={{ before: new Date() }}
                />
              )}
            />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-foreground">{t("taskPriority")}</p>
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

          {defaultCattleId ? (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-foreground">{t("targetCows")}</p>
              <span className="flex w-fit items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-bold text-foreground">
                <Tag className="size-3" aria-hidden />
                {defaultCattle ? `${defaultCattle.tagNumber}${defaultCattle.name ? ` — ${defaultCattle.name}` : ""}` : "…"}
              </span>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-foreground">{t("targetCows")}</p>
              <CattleMultiPicker value={cattle} onValueChange={setCattle} placeholder={t("targetCowsPlaceholder")} />
              {cattle.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {cattle.map((c) => (
                    <span
                      key={c.id}
                      className="flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-bold text-foreground"
                    >
                      {c.tagNumber}
                      {c.name ? ` — ${c.name}` : ""}
                      <button
                        type="button"
                        onClick={() => setCattle((prev) => prev.filter((x) => x.id !== c.id))}
                        aria-label={t("removeCow", { cow: c.tagNumber })}
                        className="text-muted-foreground transition-opacity hover:opacity-70"
                      >
                        <X className="size-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          )}

          <div className="flex items-center gap-10 rounded-xl border border-border bg-muted p-3">
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-bold text-foreground">{t("recurringTask")}</p>
              <p className="text-xs text-muted-foreground">{t("recurringTaskDesc")}</p>
            </div>
            <Controller
              control={form.control}
              name="recurring"
              render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />}
            />
          </div>

          {recurring ? (
            <Controller
              control={form.control}
              name="recurrenceType"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <LabeledSelectTrigger label={t("repeats")} placeholder={t("selectRepeats")} />
                  <SelectContent>
                    {RECURRENCE_TYPES.map((r) => (
                      <SelectItem key={r} value={r}>
                        {t(`repeatsOptions.${r}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          ) : null}

          <div className="flex items-center gap-10 rounded-xl border border-border bg-muted p-3">
            <div className="flex flex-1 flex-col gap-1">
              <p className="text-sm font-bold text-foreground">{t("safetyCritical")}</p>
              <p className="text-xs text-muted-foreground">{t("safetyCriticalDesc")}</p>
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
          <Button type="button" variant="secondary" className="h-[52px] flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={createTask.isPending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-[52px] flex-1 rounded-xl" disabled={createTask.isPending}>
            {createTask.isPending ? "…" : t("create")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
