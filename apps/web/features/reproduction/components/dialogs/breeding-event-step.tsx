"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { useCreateBreedingEvent } from "../../hooks/use-reproduction";
import { breedingEventSchema, type CreateBreedingEventInput } from "../../schemas";
import { BreedingEventFormFields } from "./breeding-event-form-fields";

function toDateTimeLocal(iso: string): string {
  const d = new Date(iso);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Edit Animal wizard step for `reproductiveStatus: BRED_AWAITING_CONFIRMATION` — same fields and
 * mutation as the standalone `BreedingEventDialog`, rendered as step 2 of the same modal instead
 * of a second popup (RAKHAL-status-fold-p5). Own `useForm`/submit, matching footer chrome to
 * `cattle-detail-sheet.tsx`'s Cancel/Edit Profile footer pattern. */
export function BreedingEventStep({
  cattleId,
  onBack,
  onDone,
}: {
  cattleId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("reproduction.dialogs.breeding");
  const tCommon = useTranslations("common");
  const createBreedingEvent = useCreateBreedingEvent();
  const form = useForm<CreateBreedingEventInput>({
    resolver: zodResolver(breedingEventSchema),
    defaultValues: {
      cattleId,
      breedingDate: toDateTimeLocal(new Date().toISOString()),
      breedingMethod: "AI",
    },
  });

  async function onSubmit(values: CreateBreedingEventInput) {
    try {
      await createBreedingEvent.mutateAsync({
        ...values,
        breedingDate: new Date(values.breedingDate).toISOString(),
        bullId: values.bullId || undefined,
        semenBatchId: values.breedingMethod === "AI" ? values.semenBatchId || undefined : undefined,
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
        <BreedingEventFormFields form={form} />
      </div>
      <div className="border-t border-border" />
      <div className="flex gap-3 px-6 py-5">
        <Button type="button" variant="secondary" className="h-12 flex-1" onClick={onBack} disabled={createBreedingEvent.isPending}>
          {tCommon("back")}
        </Button>
        <Button type="submit" className="h-12 flex-1" disabled={createBreedingEvent.isPending}>
          {createBreedingEvent.isPending ? "…" : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
