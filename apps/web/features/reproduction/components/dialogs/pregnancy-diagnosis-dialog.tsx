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
import { useCreatePregnancyDiagnosis, useEditPregnancyDiagnosis } from "../../hooks/use-reproduction";
import { pregnancyDiagnosisSchema, type CreatePregnancyDiagnosisInput } from "../../schemas";
import type { ReproEventEntry } from "../../types";

const RESULTS = ["PREGNANT", "NOT_PREGNANT", "SUSPECTED"] as const;
const METHODS = ["ULTRASOUND", "PALPATION", "LAB"] as const;

const EMPTY_DEFAULTS: CreatePregnancyDiagnosisInput = {
  cattleId: "",
  diagnosisDate: new Date().toISOString().slice(0, 10),
  result: "PREGNANT",
  diagnosisMethod: "ULTRASOUND",
};

/** RAKHAL-317-F: seeds the edit form from the events feed's own row — `EditPregnancyDiagnosisDto`
 * has no dedicated GET-by-id route, so the feed's `details` (now carrying `expected_calving_date`/
 * `gestation_day`/`notes`/`breeding_event_id`, see `reproduction.service.ts#listEvents`) is the only
 * source of the diagnosis's current values. */
function defaultsFromEvent(event: ReproEventEntry): CreatePregnancyDiagnosisInput {
  const d = event.details as {
    result?: CreatePregnancyDiagnosisInput["result"];
    method?: CreatePregnancyDiagnosisInput["diagnosisMethod"];
    gestation_day?: number | null;
    expected_calving_date?: string | null;
    breeding_event_id?: string | null;
    notes?: string | null;
  };
  return {
    cattleId: event.cattle_id,
    breedingEventId: d.breeding_event_id ?? undefined,
    diagnosisDate: event.event_date.slice(0, 10),
    result: d.result ?? "PREGNANT",
    diagnosisMethod: d.method ?? "ULTRASOUND",
    gestationDay: d.gestation_day ?? undefined,
    expectedCalvingDate: d.expected_calving_date ? d.expected_calving_date.slice(0, 10) : undefined,
    notes: d.notes ?? undefined,
  };
}

/** "Record Pregnancy Check" (PRD §9.5) — no Figma frame for this module. Mirrors
 * `CreatePregnancyDiagnosisDto`; `breedingEventId` is passed through from the "Pregnancy Check
 * Due" action-panel row when available, otherwise omitted (a standalone check).
 *
 * RAKHAL-317-F: also the edit surface for an existing diagnosis (`editingEvent` set) — same form,
 * reused per the established pattern (`breeding-event-dialog.tsx`'s `eventId` prop), with `cattleId`
 * disabled while editing (reassigning a diagnosis to a different cow is a correction the backend
 * technically allows but isn't a meaningful "edit" here, so it's not offered). */
export function PregnancyDiagnosisDialog({
  open,
  onOpenChange,
  defaultCattleId,
  defaultBreedingEventId,
  editingEvent,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCattleId?: string;
  defaultBreedingEventId?: string;
  /** When set, the dialog edits this existing `PregnancyDiagnosis` instead of creating one. */
  editingEvent?: ReproEventEntry;
}) {
  const t = useTranslations("reproduction.dialogs.pregnancyDiagnosis");
  const isEdit = !!editingEvent;
  const createDiagnosis = useCreatePregnancyDiagnosis();
  const editDiagnosis = useEditPregnancyDiagnosis();
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
    if (!open) return;
    if (editingEvent) {
      form.reset(defaultsFromEvent(editingEvent));
      return;
    }
    form.reset({ ...EMPTY_DEFAULTS, cattleId: defaultCattleId ?? "", breedingEventId: defaultBreedingEventId });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCattleId, defaultBreedingEventId, editingEvent]);

  async function onSubmit(values: CreatePregnancyDiagnosisInput) {
    try {
      const payload = {
        ...values,
        expectedCalvingDate: values.result === "PREGNANT" ? values.expectedCalvingDate || undefined : undefined,
      };
      if (isEdit && editingEvent) {
        await editDiagnosis.mutateAsync({ id: editingEvent.id, input: payload });
        toast.success(t("editedToast"));
      } else {
        await createDiagnosis.mutateAsync(payload);
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
      title={isEdit ? t("editTitle") : t("title")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={createDiagnosis.isPending || editDiagnosis.isPending}
      submitLabel={isEdit ? t("saveChanges") : t("submit")}
    >
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
              disabled={isEdit}
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
    </FormDialog>
  );
}
