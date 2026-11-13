"use client"; // form state + mutation

import { nowLocalDateTimeIso } from "@/lib/local-date";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { Label } from "@rakhal/ui/ui/label";
import { Input } from "@rakhal/ui/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rakhal/ui/ui/select";
import { useRecordColostrum } from "../../hooks/use-calves";
import { recordColostrumSchema, type RecordColostrumInput } from "../../schemas";
import { DateTimePicker } from "@/components/ui/date-time-picker";

const QUALITY_VALUES = ["EXCELLENT", "GOOD", "POOR", "UNKNOWN"] as const;

function defaults(): RecordColostrumInput {
  return { feedNumber: 1, fedAt: nowLocalDateTimeIso(), volumeMl: 0, quality: "UNKNOWN", fedBy: "", notes: "" };
}

/** `POST /calves/:id/colostrum` — `calf.log-feeding`-gated. */
export function RecordColostrumDialog({
  calfId,
  open,
  onOpenChange,
}: {
  calfId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("calves.dialogs.colostrum");
  const recordColostrum = useRecordColostrum(calfId);
  const form = useForm<RecordColostrumInput>({ resolver: zodResolver(recordColostrumSchema), defaultValues: defaults() });

  async function onSubmit(values: RecordColostrumInput) {
    try {
      await recordColostrum.mutateAsync(values);
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
      pending={recordColostrum.isPending}
      submitLabel={t("submit")}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>{t("feedNumber")}</Label>
          <Input type="number" min={1} step="1" {...form.register("feedNumber", { valueAsNumber: true })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("fedAt")}</Label>
          <Controller
            control={form.control}
            name="fedAt"
            render={({ field, fieldState }) => (
              <DateTimePicker
                label={t("fedAt")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>{t("volumeMl")}</Label>
          <Input type="number" min={0} step="1" {...form.register("volumeMl", { valueAsNumber: true })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("quality")}</Label>
          <Controller
            control={form.control}
            name="quality"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {QUALITY_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`qualityValue.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("fedBy")}</Label>
        <Input {...form.register("fedBy")} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("notes")}</Label>
        <Input {...form.register("notes")} />
      </div>
    </FormSheet>
  );
}
