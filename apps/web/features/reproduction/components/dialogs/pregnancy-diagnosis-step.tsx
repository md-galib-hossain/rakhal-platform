"use client";

import { todayLocalIso } from "@/lib/local-date";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { useCreatePregnancyDiagnosis } from "../../hooks/use-reproduction";
import { pregnancyDiagnosisSchema, type CreatePregnancyDiagnosisInput } from "../../schemas";
import { PregnancyDiagnosisFormFields } from "./pregnancy-diagnosis-form-fields";

/** Edit Animal wizard step for `reproductiveStatus: PREGNANT` — same fields and mutation as the
 * standalone `PregnancyDiagnosisDialog`, rendered as step 2 of the same modal instead of a second
 * popup (RAKHAL-status-fold-p5). */
export function PregnancyDiagnosisStep({
  cattleId,
  onBack,
  onDone,
}: {
  cattleId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("reproduction.dialogs.pregnancyDiagnosis");
  const tCommon = useTranslations("common");
  const createDiagnosis = useCreatePregnancyDiagnosis();
  const form = useForm<CreatePregnancyDiagnosisInput>({
    resolver: zodResolver(pregnancyDiagnosisSchema),
    defaultValues: {
      cattleId,
      diagnosisDate: todayLocalIso(),
      result: "PREGNANT",
      diagnosisMethod: "ULTRASOUND",
    },
  });

  async function onSubmit(values: CreatePregnancyDiagnosisInput) {
    try {
      await createDiagnosis.mutateAsync({
        ...values,
        expectedCalvingDate: values.result === "PREGNANT" ? values.expectedCalvingDate || undefined : undefined,
      });
      toast.success(t("createdToast"));
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[460px] flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        <PregnancyDiagnosisFormFields form={form} />
      </div>
      <div className="border-t border-border" />
      <div className="flex gap-3 px-6 py-5">
        <Button type="button" variant="secondary" className="h-12 flex-1" onClick={onBack} disabled={createDiagnosis.isPending}>
          {tCommon("back")}
        </Button>
        <Button type="submit" className="h-12 flex-1" disabled={createDiagnosis.isPending}>
          {createDiagnosis.isPending ? "…" : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
