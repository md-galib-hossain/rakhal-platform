"use client"; // form state + mutation

import { todayLocalIso } from "@/lib/local-date";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { Label } from "@rakhal/ui/ui/label";
import { Input } from "@rakhal/ui/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRecordStarterFeed } from "../../hooks/use-calves";
import { recordStarterFeedSchema, type RecordStarterFeedInput } from "../../schemas";
import { DatePicker } from "@/components/ui/date-picker";

const EVENT_TYPE_VALUES = ["FIRST_OFFERED", "FIRST_INTAKE", "DAILY_INTAKE"] as const;

function defaults(): RecordStarterFeedInput {
  return { date: todayLocalIso(), eventType: "DAILY_INTAKE", amountG: undefined, notes: "" };
}

/** `POST /calves/:id/starter-feed` — `calf.log-feeding`-gated. */
export function RecordStarterFeedDialog({
  calfId,
  open,
  onOpenChange,
}: {
  calfId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("calves.dialogs.starterFeed");
  const recordStarterFeed = useRecordStarterFeed(calfId);
  const form = useForm<RecordStarterFeedInput>({ resolver: zodResolver(recordStarterFeedSchema), defaultValues: defaults() });

  async function onSubmit(values: RecordStarterFeedInput) {
    try {
      await recordStarterFeed.mutateAsync(values);
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
      pending={recordStarterFeed.isPending}
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
          <Label>{t("eventType")}</Label>
          <Controller
            control={form.control}
            name="eventType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPE_VALUES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`eventTypeValue.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("amountG")}</Label>
        <Input type="number" min={0} step="1" {...form.register("amountG", { valueAsNumber: true })} />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("notes")}</Label>
        <Input {...form.register("notes")} />
      </div>
    </FormSheet>
  );
}
