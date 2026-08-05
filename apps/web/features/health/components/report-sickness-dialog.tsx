"use client";

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
import { useCreateHealthCase } from "../hooks/use-health";
import { reportSicknessSchema, type ReportSicknessInput } from "../schemas";
import type { HealthCondition, HealthDiagnosisType, HealthPriority } from "../types";

const DIAGNOSIS_TYPES: HealthDiagnosisType[] = [
  "DISEASE",
  "INJURY",
  "VACCINATION",
  "DEWORMING",
  "ROUTINE_CHECKUP",
  "PREVENTIVE",
  "BREEDING_RELATED",
  "OTHER",
];
const PRIORITIES: HealthPriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const HEALTH_CONDITIONS: HealthCondition[] = [
  "MASTITIS",
  "LAMENESS",
  "METRITIS",
  "KETOSIS",
  "MILK_FEVER",
  "FEVER",
  "INJURY",
  "OTHER",
];
const UNSET = "__unset__";

/** "Report Sickness" — no Figma frame was given for this modal (only the sick-bay page + Case
 * Management sheet), so it's a plain `FormDialog` mirroring `CreateHealthCaseDto`, needed so the
 * sick-bay table's primary action actually creates a real case. */
export function ReportSicknessDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("health.reportSickness");
  const createCase = useCreateHealthCase();
  const form = useForm<ReportSicknessInput>({
    resolver: zodResolver(reportSicknessSchema),
    defaultValues: { cattleId: "", diagnosis: "", diagnosisType: "DISEASE", priority: "MEDIUM" },
  });

  async function onSubmit(values: ReportSicknessInput) {
    try {
      await createCase.mutateAsync(values);
      toast.success(t("createdToast"));
      form.reset();
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
      pending={createCase.isPending}
      submitLabel={t("submit")}
    >
      <div className="flex flex-col gap-2">
        <Label>{t("cattle")}</Label>
        <Controller
          control={form.control}
          name="cattleId"
          render={({ field }) => <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} />}
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("diagnosis")}</Label>
        <Input {...form.register("diagnosis")} placeholder={t("diagnosisPlaceholder")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("condition")}</Label>
        <Controller
          control={form.control}
          name="condition"
          render={({ field }) => (
            <Select
              value={field.value ?? UNSET}
              onValueChange={(v) => field.onChange(v === UNSET ? undefined : v)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("conditionPlaceholder")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNSET}>{t("conditionPlaceholder")}</SelectItem>
                {HEALTH_CONDITIONS.map((v) => (
                  <SelectItem key={v} value={v}>
                    {t(`conditionValue.${v}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>{t("diagnosisType")}</Label>
          <Controller
            control={form.control}
            name="diagnosisType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DIAGNOSIS_TYPES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`diagnosisTypeValue.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("priority")}</Label>
          <Controller
            control={form.control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`priorityValue.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} placeholder={t("notesPlaceholder")} rows={3} />
      </div>
    </FormDialog>
  );
}
