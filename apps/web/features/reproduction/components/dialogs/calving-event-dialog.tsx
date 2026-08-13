"use client";

import { useEffect, useState } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { FormDialog } from "@/components/shared/form-dialog";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { PregnantCowPicker } from "../pregnant-cow-picker";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateCalvingEvent } from "../../hooks/use-reproduction";
import { calvingEventSchema, type CreateCalvingEventInput } from "../../schemas";

const CALVING_EASE = ["NORMAL", "ASSISTED", "DIFFICULT", "CESAREAN"] as const;
const CALF_STATUSES = ["ALIVE", "STILLBORN", "DIED_AFTER_BIRTH"] as const;

const EMPTY_DEFAULTS: CreateCalvingEventInput = {
  cattleId: "",
  calvingDate: new Date().toISOString().slice(0, 10),
  calvingEase: "NORMAL",
  calves: [{ gender: "FEMALE", status: "ALIVE", tagNumber: "" }],
};

/** "Record Calving" (PRD §9.7) — no Figma frame for this module. Mirrors `CreateCalvingEventDto`,
 * including the `calves[]` array (each ALIVE calf becomes a real `Cattle` record on the backend —
 * `reproduction.service.ts`'s `createCalvingEvent`), via `useFieldArray` (RHF's dynamic-rows pattern,
 * same primitive the Feed Formulator's ingredient rows already use elsewhere in this codebase). */
export function CalvingEventDialog({
  open,
  onOpenChange,
  defaultCattleId,
  defaultPregnancyId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCattleId?: string;
  defaultPregnancyId?: string;
}) {
  const t = useTranslations("reproduction.dialogs.calving");
  const createCalvingEvent = useCreateCalvingEvent();
  // Cows without a tracked pregnancy (paper-record backfills) still need a way in — this toggle
  // swaps the default "eligible for calving" picker for the plain all-female one.
  const [useAllCows, setUseAllCows] = useState(false);
  const form = useForm<CreateCalvingEventInput>({
    resolver: zodResolver(calvingEventSchema),
    defaultValues: { ...EMPTY_DEFAULTS, cattleId: defaultCattleId ?? "", pregnancyId: defaultPregnancyId },
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "calves" });

  useEffect(() => {
    if (open) {
      form.reset({ ...EMPTY_DEFAULTS, cattleId: defaultCattleId ?? "", pregnancyId: defaultPregnancyId });
      setUseAllCows(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCattleId, defaultPregnancyId]);

  async function onSubmit(values: CreateCalvingEventInput) {
    try {
      const result = await createCalvingEvent.mutateAsync({
        ...values,
        calves: values.calves?.map((calf) => ({
          ...calf,
          tagNumber: calf.status === "ALIVE" ? calf.tagNumber : undefined,
        })),
      });
      toast.success(t("createdToast"));
      // RAKHAL-290/297-F: the backend auto-closed a still-ACTIVE prior lactation (a missed dry-off)
      // rather than silently overwriting it — surface that explicitly instead of it going unnoticed.
      const closed = result.closedMissingDryOffLactation;
      if (closed) {
        toast.warning(
          t("missingDryOffToast", {
            startDate: closed.startDate.slice(0, 10),
            endDate: (closed.endDate ?? "").slice(0, 10),
          }),
          { duration: 10000 },
        );
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
      pending={createCalvingEvent.isPending}
      submitLabel={t("submit")}
      className="sm:max-w-2xl"
    >
      <div className="flex flex-col gap-2">
        <Label>{t("cattle")}</Label>
        {useAllCows ? (
          <Controller
            control={form.control}
            name="cattleId"
            render={({ field }) => (
              <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} filters={{ gender: "FEMALE" }} />
            )}
          />
        ) : (
          <Controller
            control={form.control}
            name="cattleId"
            render={({ field }) => (
              <PregnantCowPicker
                value={field.value}
                onValueChange={(cattleId, pregnancyId) => {
                  field.onChange(cattleId);
                  form.setValue("pregnancyId", pregnancyId);
                }}
              />
            )}
          />
        )}
        <button
          type="button"
          className="w-fit text-xs text-muted-foreground underline-offset-2 hover:underline"
          onClick={() => {
            setUseAllCows((v) => !v);
            form.setValue("pregnancyId", undefined);
            form.setValue("cattleId", "");
          }}
        >
          {useAllCows ? t("backToPregnantCows") : t("noPregnancyOnFile")}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <Label>{t("calvingDate")}</Label>
          <Input type="date" {...form.register("calvingDate")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("calvingEase")}</Label>
          <Controller
            control={form.control}
            name="calvingEase"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CALVING_EASE.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`easeValue.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Controller
          control={form.control}
          name="placentaExpelled"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={field.value ?? false} onCheckedChange={(v) => field.onChange(v === true)} />
              {t("placentaExpelled")}
            </label>
          )}
        />
        <Controller
          control={form.control}
          name="retainedPlacenta"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox checked={field.value ?? false} onCheckedChange={(v) => field.onChange(v === true)} />
              {t("retainedPlacenta")}
            </label>
          )}
        />
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <Label>{t("calves")}</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => append({ gender: "FEMALE", status: "ALIVE", tagNumber: "" })}
          >
            <Plus className="size-4" aria-hidden />
            {t("addCalf")}
          </Button>
        </div>
        {fields.map((calfField, index) => {
          const status = form.watch(`calves.${index}.status`);
          return (
            <div key={calfField.id} className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] items-end gap-2 rounded-lg border border-border p-2">
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("gender")}</Label>
                <Controller
                  control={form.control}
                  name={`calves.${index}.gender`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="FEMALE">{t("genderValue.FEMALE")}</SelectItem>
                        <SelectItem value="MALE">{t("genderValue.MALE")}</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("calfStatus")}</Label>
                <Controller
                  control={form.control}
                  name={`calves.${index}.status`}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CALF_STATUSES.map((v) => (
                          <SelectItem key={v} value={v}>
                            {t(`calfStatusValue.${v}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("tagNumber")}</Label>
                <Input {...form.register(`calves.${index}.tagNumber`)} disabled={status !== "ALIVE"} />
              </div>
              <div className="flex flex-col gap-1">
                <Label className="text-xs">{t("birthWeight")}</Label>
                <Input type="number" step="0.1" {...form.register(`calves.${index}.birthWeight`, { valueAsNumber: true })} />
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)} disabled={fields.length <= 1}>
                <Trash2 className="size-4" aria-hidden />
              </Button>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} placeholder={t("notesPlaceholder")} rows={2} />
      </div>
    </FormDialog>
  );
}
