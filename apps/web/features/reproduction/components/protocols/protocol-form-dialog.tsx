"use client"; // form state + step-array field array

import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Label } from "@rakhal/ui/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateProtocol, useProtocol, useUpdateProtocol } from "../../hooks/use-reproduction";
import { protocolFormSchema, reproStepTypeEnum, type ProtocolFormInput } from "../../schemas";
import type { CreateProtocolPayload, ProtocolDetail } from "../../types";

const STEP_TYPES = reproStepTypeEnum.options;

function toPayload(values: ProtocolFormInput): CreateProtocolPayload {
  return {
    name: values.name,
    description: values.description || undefined,
    steps: values.steps.map((s) => ({
      dayNumber: s.dayNumber,
      title: s.title,
      stepType: s.stepType,
      instruction: s.instruction || undefined,
      isRequired: s.isRequired,
    })),
  };
}

function toFormDefaults(protocol: ProtocolDetail | undefined): Partial<ProtocolFormInput> {
  if (!protocol) {
    return { steps: [{ dayNumber: 0, title: "", stepType: "GNRH", isRequired: true }] };
  }
  return {
    name: protocol.name,
    description: protocol.description ?? "",
    steps: protocol.steps.map((s) => ({
      dayNumber: s.day_number,
      title: s.title,
      stepType: reproStepTypeEnum.parse(s.step_type),
      instruction: s.instruction ?? "",
      isRequired: s.is_required,
    })),
  };
}

/** Create/edit a farm-owned Reproductive Protocol (RAKHAL-407) — no Figma frame, mirrors
 * `CreateHealthPlanDialog`'s exact "one dialog, an id prop set switches it to edit mode" shape
 * from the sibling Health Plan engine, minus that dialog's 3-step wizard (this form has far fewer
 * fields — no category/planType/cycleLength split to ask about). Edit mode takes only a
 * `protocolId` (the list `protocols-panel.tsx` renders from only carries `step_count`, not the
 * full step list) and fetches the real detail itself via `useProtocol`, same "sheet owns its own
 * query" precedent `feed-item-detail-sheet.tsx` established. A system-default protocol is never
 * passed in here — `protocols-panel.tsx` only wires this dialog behind the already-typed
 * `editable`/`is_system_default` flags, and the backend 404s a system default on `PATCH`/`DELETE`
 * regardless as the real enforcement point. */
export function ProtocolFormDialog({
  open,
  onOpenChange,
  protocolId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  protocolId?: string;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <ProtocolFormDialogLoader key={protocolId ?? "create"} onOpenChange={onOpenChange} protocolId={protocolId} /> : null}
    </Sheet>
  );
}

function ProtocolFormDialogLoader({
  onOpenChange,
  protocolId,
}: {
  onOpenChange: (open: boolean) => void;
  protocolId?: string;
}) {
  const t = useTranslations("reproduction.protocols.formDialog");
  const query = useProtocol(protocolId);

  if (protocolId && query.isLoading) {
    return (
      <SheetContent
        showClose={false}
        className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[600px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[600px]"
      >
        <CardSkeleton lines={4} />
      </SheetContent>
    );
  }
  if (protocolId && (query.isError || !query.data)) {
    return (
      <SheetContent
        showClose={false}
        className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[600px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[600px]"
      >
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </SheetContent>
    );
  }
  return <ProtocolFormDialogBody onOpenChange={onOpenChange} protocol={query.data} />;
}

function ProtocolFormDialogBody({
  onOpenChange,
  protocol,
}: {
  onOpenChange: (open: boolean) => void;
  protocol?: ProtocolDetail;
}) {
  const t = useTranslations("reproduction.protocols.formDialog");
  const tStepType = useTranslations("reproduction.protocols.stepType");
  const isEdit = Boolean(protocol);
  const createProtocol = useCreateProtocol();
  const updateProtocol = useUpdateProtocol();
  const pending = createProtocol.isPending || updateProtocol.isPending;

  const form = useForm<ProtocolFormInput>({
    resolver: zodResolver(protocolFormSchema),
    defaultValues: toFormDefaults(protocol),
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "steps" });

  async function onSubmit(values: ProtocolFormInput) {
    try {
      if (isEdit && protocol) {
        await updateProtocol.mutateAsync({ id: protocol.id, input: toPayload(values) });
      } else {
        await createProtocol.mutateAsync(toPayload(values));
      }
      toast.success(isEdit ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[600px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[600px]"
    >
      <div className="flex items-center justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{isEdit ? t("editTitle") : t("createTitle")}</SheetTitle>
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
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-4">
          <div className="flex flex-col gap-2">
            <Label>{t("name")}</Label>
            <Input {...form.register("name")} placeholder={t("namePlaceholder")} />
            {form.formState.errors.name ? (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <Label>{t("description")}</Label>
            <Textarea {...form.register("description")} rows={2} />
          </div>

          <div className="flex flex-col gap-3">
            <p className="text-sm font-medium text-foreground">{t("steps")}</p>
            {fields.map((fieldItem, index) => (
              <div key={fieldItem.id} className="flex flex-col gap-2 rounded-xl border border-border p-3">
                <div className="flex items-start gap-2">
                  <div className="w-[70px] shrink-0">
                    <Label className="text-xs">{t("day")}</Label>
                    <Input
                      type="number"
                      min={0}
                      {...form.register(`steps.${index}.dayNumber`, { valueAsNumber: true })}
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs">{t("title")}</Label>
                    <Input {...form.register(`steps.${index}.title`)} placeholder={t("titlePlaceholder")} />
                  </div>
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    disabled={fields.length <= 1}
                    aria-label={t("removeStep")}
                    className="mt-5 flex size-6 shrink-0 items-center justify-center rounded text-destructive transition-opacity hover:opacity-70 disabled:opacity-30"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <Label className="text-xs">{t("stepType")}</Label>
                    <Controller
                      control={form.control}
                      name={`steps.${index}.stepType`}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STEP_TYPES.map((v) => (
                              <SelectItem key={v} value={v}>
                                {tStepType(v)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="flex items-center gap-1.5 pb-2.5">
                    <Controller
                      control={form.control}
                      name={`steps.${index}.isRequired`}
                      render={({ field }) => (
                        <Checkbox checked={field.value ?? true} onCheckedChange={field.onChange} id={`required-${fieldItem.id}`} />
                      )}
                    />
                    <Label htmlFor={`required-${fieldItem.id}`} className="text-xs font-normal">
                      {t("required")}
                    </Label>
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{t("instruction")}</Label>
                  <Input {...form.register(`steps.${index}.instruction`)} placeholder={t("instructionPlaceholder")} />
                </div>
                {form.formState.errors.steps?.[index]?.title ? (
                  <p className="text-xs text-destructive">{form.formState.errors.steps[index]?.title?.message}</p>
                ) : null}
              </div>
            ))}
          </div>
          <button
            type="button"
            className="flex w-fit items-center gap-1.5 text-xs font-medium text-primary"
            onClick={() =>
              append({
                dayNumber: (form.getValues("steps").at(-1)?.dayNumber ?? 0) + 1,
                title: "",
                stepType: "OTHER",
                isRequired: true,
              })
            }
          >
            {t("addStep")}
            <Plus className="size-4" aria-hidden />
          </button>
          {form.formState.errors.steps?.message ? (
            <p className="text-xs text-destructive">{form.formState.errors.steps.message}</p>
          ) : null}
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-2 pt-5">
          <Button type="button" variant="secondary" className="h-12 flex-1" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-12 flex-1" disabled={pending}>
            {pending ? "…" : isEdit ? t("saveChanges") : t("create")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
