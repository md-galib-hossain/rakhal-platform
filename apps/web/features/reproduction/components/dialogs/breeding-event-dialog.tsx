"use client";

import { useEffect } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { apiFetchPage } from "@/lib/api/client";
import { FormDialog } from "@/components/shared/form-dialog";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useBreedingEvent, useCreateBreedingEvent, useEditBreedingEvent } from "../../hooks/use-reproduction";
import { breedingEventSchema, type CreateBreedingEventInput } from "../../schemas";

const BREEDING_METHODS = ["AI", "NATURAL", "EMBRYO_TRANSFER"] as const;

interface SemenBatchOption {
  id: string;
  name: string;
  batchCode: string | null;
  breed: string | null;
  strawQuantity: number;
}

/** `GET /inventory/semen/batches` (`inventory.read`-gated) — only batches with straws left, so an
 * AI event can't pick an empty one and 400 on the backend's `decrementStraw`. */
function useSemenBatches(enabled: boolean) {
  return useQuery({
    queryKey: ["semen-batches", "picker"],
    queryFn: () => apiFetchPage<SemenBatchOption>("/inventory/semen/batches", { searchParams: { limit: 100 } }),
    enabled,
    staleTime: 30_000,
    select: (page) => page.items.filter((b) => b.strawQuantity > 0),
  });
}

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
  const breedingMethod = form.watch("breedingMethod");
  const semenBatches = useSemenBatches(open && breedingMethod === "AI");

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
        notes: row.notes ?? undefined,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, defaultCattleId, isEdit, existing.data]);

  async function onSubmit(values: CreateBreedingEventInput) {
    try {
      const payload = {
        ...values,
        breedingDate: new Date(values.breedingDate).toISOString(),
        bullId: values.bullId || undefined,
        semenBatchId: values.breedingMethod === "AI" ? values.semenBatchId || undefined : undefined,
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
    <FormDialog
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
          <Label>{t("breedingDate")}</Label>
          <Input type="datetime-local" {...form.register("breedingDate")} />
        </div>
        <div className="flex flex-col gap-2">
          <Label>{t("breedingMethod")}</Label>
          <Controller
            control={form.control}
            name="breedingMethod"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BREEDING_METHODS.map((v) => (
                    <SelectItem key={v} value={v}>
                      {t(`breedingMethodValue.${v}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      {breedingMethod === "AI" ? (
        <div className="flex flex-col gap-2">
          <Label>{t("semenBatch")}</Label>
          <Controller
            control={form.control}
            name="semenBatchId"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("semenBatchPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {(semenBatches.data ?? []).map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name} {b.batchCode ? `(${b.batchCode})` : ""} — {t("strawsLeft", { count: b.strawQuantity })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <Label>{t("bull")}</Label>
          <Controller
            control={form.control}
            name="bullId"
            render={({ field }) => (
              <CattlePicker value={field.value} onValueChange={(id) => field.onChange(id)} filters={{ gender: "MALE" }} />
            )}
          />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <Label>{t("inseminator")}</Label>
        <Input {...form.register("inseminator")} placeholder={t("inseminatorPlaceholder")} />
      </div>

      <div className="flex flex-col gap-2">
        <Label>{t("notes")}</Label>
        <Textarea {...form.register("notes")} placeholder={t("notesPlaceholder")} rows={2} />
      </div>
    </FormDialog>
  );
}
