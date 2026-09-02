"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { useCreateHeatEvent } from "../../hooks/use-reproduction";
import { heatEventSchema, type CreateHeatEventInput } from "../../schemas";
import { HeatEventFormFields } from "./heat-event-form-fields";

function nowLocalIso(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** "Record Heat Observation" (PRD §9.3) — no Figma frame for this module, mirrors the shape of
 * `ReportSicknessDialog` (Healthcare's own no-Figma form). Mirrors `CreateHeatEventDto` exactly. */
export function HeatEventDialog({
  open,
  onOpenChange,
  defaultCattleId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCattleId?: string;
}) {
  const t = useTranslations("reproduction.dialogs.heat");
  const createHeatEvent = useCreateHeatEvent();
  const form = useForm<CreateHeatEventInput>({
    resolver: zodResolver(heatEventSchema),
    defaultValues: {
      cattleId: defaultCattleId ?? "",
      heatDateTime: nowLocalIso(),
      detectionMethod: "VISUAL",
    },
  });

  useEffect(() => {
    if (open) form.reset({ cattleId: defaultCattleId ?? "", heatDateTime: nowLocalIso(), detectionMethod: "VISUAL" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCattleId]);

  async function onSubmit(values: CreateHeatEventInput) {
    try {
      const created = await createHeatEvent.mutateAsync({
        ...values,
        heatDateTime: new Date(values.heatDateTime).toISOString(),
      });
      // RAKHAL-318: the row is still created (real data, never dropped) but flagged when the cow
      // has an active pregnancy — surface the conflict instead of a plain success toast.
      if (created.activePregnancyConflict) {
        toast.warning(t("activePregnancyConflictToast"));
      } else {
        toast.success(t("createdToast"));
      }
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <FormSheet
      open={open}
      onOpenChange={(next) => {
        if (!next) form.reset();
        onOpenChange(next);
      }}
      title={t("title")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={createHeatEvent.isPending}
      submitLabel={t("submit")}
    >
      <HeatEventFormFields form={form} />
    </FormSheet>
  );
}
