"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useCreateAbortionEvent } from "../../hooks/use-reproduction";
import { abortionEventSchema, type CreateAbortionEventInput } from "../../schemas";
import { DatePicker } from "@/components/ui/date-picker";

const EMPTY_DEFAULTS: CreateAbortionEventInput = {
  cattleId: "",
  abortionDate: new Date().toISOString().slice(0, 10),
};

/** "Record Abortion" — no dedicated PRD section number, but the backend fully supports it
 * (`AbortionEvent`/`CreateAbortionEventDto`) and the unified events feed surfaces abortion events,
 * so a create path is needed. No Figma frame for this module. */
export function AbortionEventDialog({
  open,
  onOpenChange,
  defaultCattleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCattleId?: string;
}) {
  const t = useTranslations("reproduction.dialogs.abortion");
  const createAbortionEvent = useCreateAbortionEvent();
  const form = useForm<CreateAbortionEventInput>({
    resolver: zodResolver(abortionEventSchema),
    defaultValues: { ...EMPTY_DEFAULTS, cattleId: defaultCattleId ?? "" },
  });

  useEffect(() => {
    if (open) form.reset({ ...EMPTY_DEFAULTS, cattleId: defaultCattleId ?? "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCattleId]);

  async function onSubmit(values: CreateAbortionEventInput) {
    try {
      await createAbortionEvent.mutateAsync(values);
      toast.success(t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset();
        onOpenChange(next);
      }}
      title={t("title")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={createAbortionEvent.isPending}
      submitLabel={t("submit")}
    >
      <div className="flex flex-col gap-2">
        <Label>{t("cattle")}</Label>
        <Controller
          control={form.control}
          name="cattleId"
          render={({ field }) => (
            <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} filters={{ gender: "FEMALE" }} />
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>{t("abortionDate")}</Label>
          <Controller
            control={form.control}
            name="abortionDate"
            render={({ field, fieldState }) => (
              <DatePicker
                label={t("abortionDate")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("gestationDay")}</Label>
          <Input type="number" {...form.register("gestationDay", { valueAsNumber: true })} />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("suspectedCause")}</Label>
        <Input {...form.register("suspectedCause")} placeholder={t("suspectedCausePlaceholder")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} placeholder={t("notesPlaceholder")} rows={2} />
      </div>
    </FormSheet>
  );
}
