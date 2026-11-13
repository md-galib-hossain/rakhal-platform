"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { Label } from "@rakhal/ui/ui/label";
import { Input } from "@/components/ui/input";
import { useRecordWeight } from "../../hooks/use-cattle-detail-tabs";
import { recordWeightSchema, type RecordWeightInput } from "../../schemas";
import { DateTimePicker } from "@/components/ui/date-time-picker";

/** Weight event (`POST /cattle/:id/events`, type WEIGHT; RAKHAL-039) — `cattle.update`-gated (manager+, no worker perm yet). */
export function RecordWeightDialog({
  cattleId,
  open,
  onOpenChange,
}: {
  cattleId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("cattle.detail.performance.recordWeightDialog");
  const recordWeight = useRecordWeight(cattleId);

  const form = useForm<RecordWeightInput>({
    resolver: zodResolver(recordWeightSchema),
    defaultValues: { weightKg: undefined, date: "", notes: "" },
  });

  async function onSubmit(values: RecordWeightInput) {
    try {
      // `date` is a `datetime-local` value (`YYYY-MM-DDTHH:mm`, no timezone) — convert to a real
      // ISO instant before sending; left blank, omit it entirely so the backend defaults to now.
      const date = values.date ? new Date(values.date).toISOString() : undefined;
      await recordWeight.mutateAsync({ ...values, date });
      toast.success(t("recordedToast"));
      form.reset({ weightKg: undefined, date: "", notes: "" });
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={recordWeight.isPending}
      submitLabel={t("save")}
      cancelLabel={t("cancel")}
    >
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="record-weight-kg">{t("weightKg")}</Label>
        <Input
          id="record-weight-kg"
          type="number"
          step="0.1"
          min={10}
          max={2000}
          {...form.register("weightKg", { valueAsNumber: true })}
        />
        {form.formState.errors.weightKg ? (
          <p className="text-xs text-destructive">{form.formState.errors.weightKg.message}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="record-weight-date">{t("date")}</Label>
        <Controller
          control={form.control}
          name="date"
          render={({ field, fieldState }) => (
            <DateTimePicker
              id="record-weight-date"
              label={t("date")}
              placeholder={t("dateBlankHint")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
              clearable
            />
          )}
        />
        <p className="text-xs text-muted-foreground">{t("dateBlankHint")}</p>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="record-weight-notes">{t("notes")}</Label>
        <Input id="record-weight-notes" {...form.register("notes")} />
      </div>
    </FormSheet>
  );
}
