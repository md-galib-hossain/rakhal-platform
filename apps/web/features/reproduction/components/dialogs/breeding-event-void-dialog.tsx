"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { FormSheet } from "@/components/shared/form-sheet";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useVoidBreedingEvent } from "../../hooks/use-reproduction";
import { voidBreedingEventSchema, type VoidBreedingEventInput } from "../../schemas";
import type { ReproEventEntry } from "../../types";

/**
 * "Void this breeding" - the undo for an AI / breeding recorded by mistake (wrong cow, duplicate, never
 * happened). Opened from a breeding row in the Reproduction events feed (`reproduction.update`, manager+).
 *
 * Voiding keeps the record (marked voided, with who / when / why) and reverses what it did: the cost goes
 * back out of Finance, the straw returns to its batch, the heat it closed reopens and the pregnancy-check
 * reminder is cancelled. The backend refuses it once a pregnancy check exists on that breeding - the
 * message it returns is shown as-is, so the farmer learns to fix the check first.
 */
export function BreedingEventVoidDialog({
  open,
  onOpenChange,
  event,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event?: ReproEventEntry;
}) {
  const t = useTranslations("reproduction.dialogs.voidBreeding");
  const voidBreeding = useVoidBreedingEvent();
  const form = useForm<VoidBreedingEventInput>({
    resolver: zodResolver(voidBreedingEventSchema),
    defaultValues: { reason: "" },
  });

  useEffect(() => {
    if (open) form.reset({ reason: "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  async function onSubmit(values: VoidBreedingEventInput) {
    if (!event) return;
    try {
      await voidBreeding.mutateAsync({ id: event.id, input: values });
      toast.success(t("voidedToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const cow = event?.cattle_name ?? event?.cattle_tag ?? "";

  return (
    <FormSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description", { cow })}
      onSubmit={form.handleSubmit(onSubmit)}
      pending={voidBreeding.isPending}
      submitLabel={t("submit")}
    >
      <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border bg-muted/40 p-3">
        <p className="text-sm font-medium text-foreground">{t("effectsTitle")}</p>
        <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
          <li>{t("effectCost")}</li>
          <li>{t("effectStraw")}</li>
          <li>{t("effectHeat")}</li>
          <li>{t("effectTask")}</li>
          <li>{t("effectKept")}</li>
        </ul>
      </div>
      <div className="flex flex-col gap-2">
        <Label>{t("reason")}</Label>
        <Textarea
          {...form.register("reason")}
          placeholder={t("reasonPlaceholder")}
          rows={3}
          aria-invalid={form.formState.errors.reason ? true : undefined}
        />
        {form.formState.errors.reason ? (
          <p className="text-xs text-destructive">{t("reasonRequired")}</p>
        ) : null}
      </div>
    </FormSheet>
  );
}
