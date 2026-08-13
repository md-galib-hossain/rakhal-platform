"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { useCreateHeatEvent } from "../../hooks/use-reproduction";
import { heatEventSchema, type CreateHeatEventInput } from "../../schemas";
import { HeatEventFormFields } from "./heat-event-form-fields";

function nowLocalIso(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

/** Edit Animal wizard step for `reproductiveStatus: OPEN` (heat detected) — same fields and
 * mutation as the standalone `HeatEventDialog`, rendered as step 2 of the same modal instead of a
 * second popup (RAKHAL-status-fold-p5). */
export function HeatEventStep({
  cattleId,
  onBack,
  onDone,
}: {
  cattleId: string;
  onBack: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("reproduction.dialogs.heat");
  const tCommon = useTranslations("common");
  const createHeatEvent = useCreateHeatEvent();
  const form = useForm<CreateHeatEventInput>({
    resolver: zodResolver(heatEventSchema),
    defaultValues: { cattleId, heatDateTime: nowLocalIso(), detectionMethod: "VISUAL" },
  });

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
      onDone();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-[460px] flex-1 flex-col gap-4 overflow-y-auto px-6 py-5">
        <HeatEventFormFields form={form} />
      </div>
      <div className="border-t border-border" />
      <div className="flex gap-3 px-6 py-5">
        <Button type="button" variant="secondary" className="h-12 flex-1" onClick={onBack} disabled={createHeatEvent.isPending}>
          {tCommon("back")}
        </Button>
        <Button type="submit" className="h-12 flex-1" disabled={createHeatEvent.isPending}>
          {createHeatEvent.isPending ? "…" : tCommon("save")}
        </Button>
      </div>
    </form>
  );
}
