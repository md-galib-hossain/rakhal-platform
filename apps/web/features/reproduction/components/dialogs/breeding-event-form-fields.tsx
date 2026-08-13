"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { apiFetchPage } from "@/lib/api/client";
import { CattlePicker } from "@/components/shared/cattle-picker";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CreateBreedingEventInput } from "../../schemas";

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

/** Pure field markup for a breeding-event form, extracted out of `breeding-event-dialog.tsx` so
 * `breeding-event-step.tsx` (Edit Animal's wizard step) can render the identical fields without
 * duplicating them — the dialog and the step each own their own `useForm`/mutation/submit, this
 * component only needs the shared `form` instance. */
export function BreedingEventFormFields({ form }: { form: UseFormReturn<CreateBreedingEventInput> }) {
  const t = useTranslations("reproduction.dialogs.breeding");
  const breedingMethod = form.watch("breedingMethod");
  const semenBatches = useSemenBatches(breedingMethod === "AI");

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
    </>
  );
}
