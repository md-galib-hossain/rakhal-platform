"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormDialog } from "@/components/shared/form-dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useReturnToHeat } from "../../hooks/use-reproduction";
import { returnToHeatSchema, type ReturnToHeatInput } from "../../schemas";

const EMPTY_DEFAULTS: ReturnToHeatInput = {
  heatDateTime: new Date().toISOString().slice(0, 10),
};

/**
 * RAKHAL-316-F. Opened from the "Pregnancy Check Due" panel row for a specific `BreedingEvent` —
 * an explicit farmer-confirmed action, matching the spec's "farmer confirms this is a return to
 * heat" gate. Never creates a `PregnancyDiagnosis` (see the backend `returnToHeat` doc comment).
 */
export function ReturnToHeatDialog({
  open,
  onOpenChange,
  breedingEventId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  breedingEventId?: string;
}) {
  const t = useTranslations("reproduction.dialogs.returnToHeat");
  const returnToHeat = useReturnToHeat();
  const form = useForm<ReturnToHeatInput>({
    resolver: zodResolver(returnToHeatSchema),
    defaultValues: EMPTY_DEFAULTS,
  });

  useEffect(() => {
    if (open) form.reset(EMPTY_DEFAULTS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function onSubmit(values: ReturnToHeatInput) {
    if (!breedingEventId) return;
    try {
      await returnToHeat.mutateAsync({ breedingEventId, input: values });
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
      description={t("description")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={returnToHeat.isPending}
      submitLabel={t("submit")}
    >
      <div className="flex flex-col gap-2">
        <Label>{t("heatDateTime")}</Label>
        <Input type="date" {...form.register("heatDateTime")} />
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} placeholder={t("notesPlaceholder")} rows={2} />
      </div>
    </FormDialog>
  );
}
