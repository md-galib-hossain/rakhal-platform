"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslations } from "next-intl";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CreateHeatEventInput } from "../../schemas";

const DETECTION_METHODS = ["VISUAL", "COLLAR_SENSOR", "PEDOMETER", "MANUAL"] as const;

/** Pure field markup for a heat-event form, extracted out of `heat-event-dialog.tsx` so
 * `heat-event-step.tsx` (Edit Animal's wizard step) can render the identical fields without
 * duplicating them. */
export function HeatEventFormFields({ form }: { form: UseFormReturn<CreateHeatEventInput> }) {
  const t = useTranslations("reproduction.dialogs.heat");

  return (
    <>
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
    </>
  );
}
