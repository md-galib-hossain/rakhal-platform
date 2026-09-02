"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecordMilkFeeding } from "../../hooks/use-calves";
import { recordMilkFeedingSchema, type RecordMilkFeedingInput } from "../../schemas";
import { DatePicker } from "@/components/ui/date-picker";

const MILK_TYPE_VALUES = ["DAM_MILK", "WHOLE_MILK", "MILK_REPLACER"] as const;

function defaults(): RecordMilkFeedingInput {
  return { date: new Date().toISOString().slice(0, 10), morningMl: undefined, eveningMl: undefined, type: "WHOLE_MILK", notes: "" };
}

/** `POST /calves/:id/milk-feeding` — `calf.log-feeding`-gated. */
export function RecordMilkFeedingDialog({
  calfId,
  open,
  onOpenChange,
}: {
  calfId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("calves.dialogs.milkFeeding");
  const recordMilkFeeding = useRecordMilkFeeding(calfId);
  const form = useForm<RecordMilkFeedingInput>({ resolver: zodResolver(recordMilkFeedingSchema), defaultValues: defaults() });

  async function onSubmit(values: RecordMilkFeedingInput) {
    try {
      await recordMilkFeeding.mutateAsync(values);
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
      pending={recordMilkFeeding.isPending}
      submitLabel={t("submit")}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>{t("date")}</Label>
          <Controller
            control={form.control}
            name="date"
            render={({ field, fieldState }) => (
              <DatePicker
                label={t("date")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("type")}</Label>
          <Controller
            control={form.control}
            name="type"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MILK_TYPE_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`typeValue.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>{t("morningMl")}</Label>
          <Input type="number" min={0} step="1" {...form.register("morningMl", { valueAsNumber: true })} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("eveningMl")}</Label>
          <Input type="number" min={0} step="1" {...form.register("eveningMl", { valueAsNumber: true })} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("notes")}</Label>
        <Input {...form.register("notes")} />
      </div>
    </FormSheet>
  );
}
