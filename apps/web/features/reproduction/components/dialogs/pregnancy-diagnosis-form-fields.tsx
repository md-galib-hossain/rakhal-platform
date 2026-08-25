"use client";

import { useEffect } from "react";
import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CreatePregnancyDiagnosisInput } from "../../schemas";

const RESULTS = ["PREGNANT", "NOT_PREGNANT", "SUSPECTED"] as const;
const METHODS = ["ULTRASOUND", "PALPATION", "LAB"] as const;
/** Average bovine gestation length (days) used to auto-derive the expected calving date. */
const GESTATION_DAYS = 283;

function addDays(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Pure field markup for a pregnancy-diagnosis form, extracted out of
 * `pregnancy-diagnosis-dialog.tsx` so `pregnancy-diagnosis-step.tsx` (Edit Animal's wizard step)
 * can render the identical fields without duplicating them. */
export function PregnancyDiagnosisFormFields({
  form,
  cattleDisabled,
}: {
  form: UseFormReturn<CreatePregnancyDiagnosisInput>;
  /** Disabled while editing an existing diagnosis (reassigning to a different cow isn't a
   * meaningful "edit" here) — the Edit Animal wizard step always creates fresh, so it never sets
   * this. */
  cattleDisabled?: boolean;
}) {
  const t = useTranslations("reproduction.dialogs.pregnancyDiagnosis");
  const result = form.watch("result");
  const diagnosisDate = form.watch("diagnosisDate");

  useEffect(() => {
    if (result !== "PREGNANT" || !diagnosisDate) return;
    if (form.formState.dirtyFields.expectedCalvingDate) return;
    form.setValue("expectedCalvingDate", addDays(diagnosisDate, GESTATION_DAYS), { shouldValidate: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, diagnosisDate]);

  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>{t("cattle")}</Label>
        <Controller
          control={form.control}
          name="cattleId"
          render={({ field }) => (
            <CattlePicker
              value={field.value}
              onValueChange={(id) => field.onChange(id)}
              filters={{ gender: "FEMALE" }}
              disabled={cattleDisabled}
            />
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
    </>
  );
}
