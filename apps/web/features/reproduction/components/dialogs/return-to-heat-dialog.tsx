"use client";

import { todayLocalIso } from "@/lib/local-date";
import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useReturnToHeat } from "../../hooks/use-reproduction";
import { returnToHeatSchema, type ReturnToHeatInput } from "../../schemas";
import { DatePicker } from "@/components/ui/date-picker";

const EMPTY_DEFAULTS: ReturnToHeatInput = {
  heatDateTime: todayLocalIso(),
};

/**
 * RAKHAL-316-F. Opened from the "Pregnancy Check Due" panel row for a specific `BreedingEvent` —
 * an explicit farmer-confirmed action, matching the spec's "farmer confirms this is a return to
 * heat" gate. Never creates a `PregnancyDiagnosis` (see the backend `returnToHeat` doc comment).
 */
export function ReturnToHeatDialog({
  open,
  onOpenChange,
  breedingEventId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breedingEventId?: string;
}) {
  const t = useTranslations("reproduction.dialogs.returnToHeat");
  const returnToHeat = useReturnToHeat();
  const form = useForm<ReturnToHeatInput>({
    resolver: zodResolver(returnToHeatSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  useEffect(() => {
    if (open) form.reset(EMPTY_DEFAULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: ReturnToHeatInput) {
    if (!breedingEventId) return;
    try {
      await returnToHeat.mutateAsync({ breedingEventId, input: values });
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
      description={t("description")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={returnToHeat.isPending}
      submitLabel={t("submit")}
    >
      <div className="flex flex-col gap-2">
        <Label>{t("heatDateTime")}</Label>
        <Controller
          control={form.control}
          name="heatDateTime"
          render={({ field, fieldState }) => (
            <DatePicker
              label={t("heatDateTime")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} placeholder={t("notesPlaceholder")} rows={2} />
      </div>
    </FormSheet>
  );
}
