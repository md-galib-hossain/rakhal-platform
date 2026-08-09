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
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateHeatEvent } from "../../hooks/use-reproduction";
import { heatEventSchema, type CreateHeatEventInput } from "../../schemas";

const DETECTION_METHODS = ["VISUAL", "COLLAR_SENSOR", "PEDOMETER", "MANUAL"] as const;

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
    <FormDialog
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
          <Label>{t("heatDateTime")}</Label>
          <Input type="datetime-local" {...form.register("heatDateTime")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("detectionMethod")}</Label>
          <Controller
            control={form.control}
            name="detectionMethod"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DETECTION_METHODS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`detectionMethodValue.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["standingHeat", "mucusDischarge", "mountingBehavior", "restlessness"] as const).map((key) => (
          <Controller
            key={key}
            control={form.control}
            name={key}
            render={({ field }) => (
              <label className="flex items-center gap-2 text-sm text-foreground">
                <Checkbox checked={field.value ?? false} onCheckedChange={(v) => field.onChange(v === true)} />
                {t(`symptoms.${key}`)}
              </label>
            )}
          />
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} placeholder={t("notesPlaceholder")} rows={2} />
      </div>
    </FormDialog>
  );
}
