"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormDialog } from "@/components/shared/form-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWeanCalf } from "../../hooks/use-calves";
import { weanCalfSchema, type WeanCalfInput } from "../../schemas";

const NEW_PURPOSE_VALUES = ["MILK", "BREEDING", "MEAT", "BULL_SERVICE", "DUAL_PURPOSE"] as const;

function defaults(): WeanCalfInput {
  return { weaningDate: new Date().toISOString().slice(0, 10), weaningWeightKg: undefined, newPurpose: undefined, notes: "" };
}

/** `POST /calves/:id/wean` — `calf.update`-gated. Irreversible: the backend flips `purpose` away
 * from `CALF` and moves the row out of Calf Management into the Cattle module for good
 * (`movedToCattleModule: true`, `removedFromCalfManagement: true`); a second wean attempt 400s. */
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
      await weanCalf.mutateAsync({ ...values, newPurpose: values.newPurpose || undefined });
      toast.success(t("weanedToast"));
      form.reset(defaults());
      onOpenChange(false);
      onWeaned();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormDialog
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
          <Input type="date" {...form.register("weaningDate")} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>{t("weaningWeightKg")}</Label>
          <Input type="number" min={0} step="0.1" {...form.register("weaningWeightKg", { valueAsNumber: true })} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("newPurpose")}</Label>
        <Controller
          control={form.control}
          name="newPurpose"
          render={({ field }) => (
            <Select value={field.value ?? ""} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue placeholder={t("newPurposeAuto")} />
              </SelectTrigger>
              <SelectContent>
                {NEW_PURPOSE_VALUES.map((v) => (
                  <SelectItem key={v} value={v}>
                    {t(`newPurposeValue.${v}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label>{t("notes")}</Label>
        <Input {...form.register("notes")} />
      </div>
    </FormDialog>
  );
}
