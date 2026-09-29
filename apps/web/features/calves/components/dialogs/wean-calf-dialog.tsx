"use client"; // form state + mutation

import { todayLocalIso } from "@/lib/local-date";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useWeanCalf } from "../../hooks/use-calves";
import { weanCalfSchema, type WeanCalfInput } from "../../schemas";
import { DatePicker } from "@/components/ui/date-picker";

function defaults(): WeanCalfInput {
  return { weaningDate: todayLocalIso(), weaningWeightKg: undefined, notes: "" };
}

/** `POST /calves/:id/wean` — `calf.update`-gated. Irreversible: records weaning and moves
 * the row out of Calf Management into the Cattle module (`movedToCattleModule: true`,
 * `removedFromCalfManagement: true`); a second wean attempt 400s. */
export function WeanCalfDialog({
  calfId,
  open,
  onOpenChange,
  onWeaned,
}: {
  calfId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onWeaned: () => void;
}) {
  const t = useTranslations("calves.dialogs.wean");
  const weanCalf = useWeanCalf(calfId);
  const form = useForm<WeanCalfInput>({ resolver: zodResolver(weanCalfSchema), defaultValues: defaults() });

  async function onSubmit(values: WeanCalfInput) {
    try {
      await weanCalf.mutateAsync(values);
      toast.success(t("weanedToast"));
      form.reset(defaults());
      onOpenChange(false);
      onWeaned();
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
      description={t("warning")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={weanCalf.isPending}
      submitLabel={t("submit")}
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <Label>{t("weaningDate")}</Label>
          <Controller
            control={form.control}
            name="weaningDate"
            render={({ field, fieldState }) => (
              <DatePicker
                label={t("weaningDate")}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                error={fieldState.error?.message}
              />
            )}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("weaningWeightKg")}</Label>
          <Input type="number" min={0} step="0.1" {...form.register("weaningWeightKg", { valueAsNumber: true })} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("notes")}</Label>
        <Input {...form.register("notes")} />
      </div>
    </FormSheet>
  );
}
