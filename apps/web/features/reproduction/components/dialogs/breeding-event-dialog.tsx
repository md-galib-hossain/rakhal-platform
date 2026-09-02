"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { useBreedingEvent, useCreateBreedingEvent, useEditBreedingEvent } from "../../hooks/use-reproduction";
import { breedingEventSchema, type CreateBreedingEventInput } from "../../schemas";
import { BreedingEventFormFields } from "./breeding-event-form-fields";

/** `datetime-local` input value in the browser's own timezone (RAKHAL-305-F: `breedingDate` is a
 * full `DateTime` column, `@IsDateString()` accepts either shape — only the form was date-only). */
function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

const EMPTY_DEFAULTS: CreateBreedingEventInput = {
  cattleId: "",
  breedingDate: toDateTimeLocal(new Date().toISOString()),
  breedingMethod: "AI",
  semenSource: "FARM_INVENTORY",
};

/** "Record AI Event" (PRD §9.4) — no Figma frame for this module. Mirrors `CreateBreedingEventDto`;
 * the semen-batch picker only shows for `breedingMethod === "AI"` (the backend only decrements a
 * straw for AI events, `reproduction.service.ts`'s `createBreedingEvent`). */
export function BreedingEventDialog({
  open,
  onOpenChange,
  defaultCattleId,
  eventId,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultCattleId?: string;
  /** When set, the dialog edits this existing `BreedingEvent` (RAKHAL-305) instead of creating one. */
  eventId?: string;
}) {
  const t = useTranslations("reproduction.dialogs.breeding");
  const isEdit = !!eventId;
  const createBreedingEvent = useCreateBreedingEvent();
  const editBreedingEvent = useEditBreedingEvent();
  const existing = useBreedingEvent(open ? eventId : undefined);
  const form = useForm<CreateBreedingEventInput>({
    resolver: zodResolver(breedingEventSchema),
    defaultValues: { ...EMPTY_DEFAULTS, cattleId: defaultCattleId ?? "" },
  });
  useEffect(() => {
    if (!open) return;
    if (!isEdit) {
      form.reset({ ...EMPTY_DEFAULTS, cattleId: defaultCattleId ?? "" });
      return;
    }
    if (existing.data) {
      const row = existing.data;
      form.reset({
        cattleId: row.cattleId,
        breedingDate: toDateTimeLocal(row.breedingDate),
        breedingMethod: row.breedingMethod,
        bullId: row.bullId ?? undefined,
        semenBatchId: row.semenBatchId ?? undefined,
        inseminator: row.inseminator ?? undefined,
        semenSource: row.semenSource ?? "FARM_INVENTORY",
        serviceProviderId: row.serviceProviderId ?? undefined,
        sireNameOrCode: row.sireNameOrCode ?? undefined,
        sireBreed: row.sireBreed ?? undefined,
        semenType: row.semenType ?? undefined,
        targetSex: row.targetSex ?? undefined,
        strawBatchCode: row.strawBatchCode ?? undefined,
        semenCompany: row.semenCompany ?? undefined,
        serviceCost: row.serviceCost ?? undefined,
        notes: row.notes ?? undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCattleId, isEdit, existing.data]);

  async function onSubmit(values: CreateBreedingEventInput) {
    try {
      const isAi = values.breedingMethod === "AI";
      const isFarmInventory = isAi && values.semenSource === "FARM_INVENTORY";
      const isTechnicianSupplied = isAi && values.semenSource === "TECHNICIAN_SUPPLIED";
      const payload = {
        ...values,
        breedingDate: new Date(values.breedingDate).toISOString(),
        bullId: values.bullId || undefined,
        semenSource: isAi ? values.semenSource : undefined,
        semenBatchId: isFarmInventory ? values.semenBatchId || undefined : undefined,
        serviceProviderId: isTechnicianSupplied ? values.serviceProviderId || undefined : undefined,
        sireNameOrCode: isAi && !isFarmInventory ? values.sireNameOrCode || undefined : undefined,
        sireBreed: isAi && !isFarmInventory ? values.sireBreed || undefined : undefined,
        semenType: isAi && !isFarmInventory ? values.semenType || undefined : undefined,
        targetSex: isAi && !isFarmInventory ? values.targetSex || undefined : undefined,
        strawBatchCode: isAi && !isFarmInventory ? values.strawBatchCode || undefined : undefined,
        semenCompany: isAi && !isFarmInventory ? values.semenCompany || undefined : undefined,
        // RAKHAL-330: a FARM_INVENTORY cost comes from the batch server-side, never a manual value —
        // every other method (AI-manual-source, NATURAL, EMBRYO_TRANSFER) keeps whatever was entered.
        serviceCost: isFarmInventory ? undefined : values.serviceCost,
        paymentMethod: values.paymentMethod || undefined,
      };
      if (isEdit && eventId) {
        await editBreedingEvent.mutateAsync({ id: eventId, input: payload });
        toast.success(t("editedToast"));
      } else {
        await createBreedingEvent.mutateAsync(payload);
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
      title={isEdit ? t("editTitle") : t("title")}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={createBreedingEvent.isPending || editBreedingEvent.isPending}
      submitLabel={isEdit ? t("saveChanges") : t("submit")}
    >
      <BreedingEventFormFields form={form} />
    </FormSheet>
  );
}
