"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useRecordWeight } from "../../hooks/use-calves";
import { recordWeightSchema, type RecordWeightInput } from "../../schemas";
import { DatePicker } from "@/components/ui/date-picker";

function defaults(): RecordWeightInput {
  return { weightKg: undefined as unknown as number, measuredDate: new Date().toISOString().slice(0, 10), notes: "" };
}

/** `POST /calves/:id/weight` — `calf.log-feeding`-gated. */
export function RecordWeightDialog({
  calfId,
  open,
  onOpenChange,
}: {
  calfId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("calves.dialogs.weight");
  const recordWeight = useRecordWeight(calfId);
  const form = useForm<RecordWeightInput>({ resolver: zodResolver(recordWeightSchema), defaultValues: defaults() });

  async function onSubmit(values: RecordWeightInput) {
    try {
      await recordWeight.mutateAsync(values);
      toast.success(t("createdToast"));
      form.reset(defaults());
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset(defaults());
        onOpenChange(next);
      }}
      title={t("title")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={recordWeight.isPending}
      submitLabel={t("submit")}
    >
      <div className="flex flex-col gap-1.5">
        <Label>{t("weightKg")}</Label>
        <Input type="number" step="0.1" min={0} {...form.register("weightKg", { valueAsNumber: true })} />
        {form.formState.errors.weightKg ? (
          <p className="text-xs text-destructive">{form.formState.errors.weightKg.message}</p>
        ) : null}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("measuredDate")}</Label>
        <Controller
          control={form.control}
          name="measuredDate"
          render={({ field, fieldState }) => (
            <DatePicker
              label={t("measuredDate")}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              error={fieldState.error?.message}
            />
          )}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("notes")}</Label>
        <Input {...form.register("notes")} />
      </div>
    </FormSheet>
  );
}
