"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormDialog } from "@/components/shared/form-dialog";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreatePregnancyDiagnosis } from "../../hooks/use-reproduction";
import { pregnancyDiagnosisSchema, type CreatePregnancyDiagnosisInput } from "../../schemas";

const RESULTS = ["PREGNANT", "NOT_PREGNANT", "SUSPECTED"] as const;
const METHODS = ["ULTRASOUND", "PALPATION", "LAB"] as const;

const EMPTY_DEFAULTS: CreatePregnancyDiagnosisInput = {
  cattleId: "",
  diagnosisDate: new Date().toISOString().slice(0, 10),
  result: "PREGNANT",
  diagnosisMethod: "ULTRASOUND",
};

/** "Record Pregnancy Check" (PRD §9.5) — no Figma frame for this module. Mirrors
 * `CreatePregnancyDiagnosisDto`; `breedingEventId` is passed through from the "Pregnancy Check
 * Due" action-panel row when available, otherwise omitted (a standalone check). */
export function PregnancyDiagnosisDialog({
  open,
  onOpenChange,
  defaultCattleId,
  defaultBreedingEventId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCattleId?: string;
  defaultBreedingEventId?: string;
}) {
  const t = useTranslations("reproduction.dialogs.pregnancyDiagnosis");
  const createDiagnosis = useCreatePregnancyDiagnosis();
  const form = useForm<CreatePregnancyDiagnosisInput>({
    resolver: zodResolver(pregnancyDiagnosisSchema),
    defaultValues: {
      ...EMPTY_DEFAULTS,
      cattleId: defaultCattleId ?? "",
      breedingEventId: defaultBreedingEventId,
    },
  });
  const result = form.watch("result");

  useEffect(() => {
    if (open) {
      form.reset({ ...EMPTY_DEFAULTS, cattleId: defaultCattleId ?? "", breedingEventId: defaultBreedingEventId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCattleId, defaultBreedingEventId]);

  async function onSubmit(values: CreatePregnancyDiagnosisInput) {
    try {
      await createDiagnosis.mutateAsync({
        ...values,
        expectedCalvingDate: values.result === "PREGNANT" ? values.expectedCalvingDate || undefined : undefined,
      });
      toast.success(t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset();
        onOpenChange(next);
      }}
      title={t("title")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={createDiagnosis.isPending}
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
          <Label>{t("diagnosisDate")}</Label>
          <Input type="date" {...form.register("diagnosisDate")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("diagnosisMethod")}</Label>
          <Controller
            control={form.control}
            name="diagnosisMethod"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {METHODS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`methodValue.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("result")}</Label>
        <Controller
          control={form.control}
          name="result"
          render={({ field }) => (
            <Select value={field.value} onValueChange={field.onChange}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESULTS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {t(`resultValue.${v}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      {result === "PREGNANT" ? (
        <div className="flex flex-col gap-2">
          <Label>{t("expectedCalvingDate")}</Label>
          <Input type="date" {...form.register("expectedCalvingDate")} />
        </div>
      ) : null}

      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} placeholder={t("notesPlaceholder")} rows={2} />
      </div>
    </FormDialog>
  );
}
