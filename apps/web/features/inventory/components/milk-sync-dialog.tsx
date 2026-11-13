"use client"; // form state + mutation

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput } from "@/components/ui/labeled-field";
import { Textarea } from "@rakhal/ui/ui/textarea";
import { Chip } from "@rakhal/ui/ui/chip";
import { Button } from "@rakhal/ui/ui/button";
import { useAdjustMilkTankVolume, useUpdateMilkTank } from "../hooks/use-inventory";
import { milkTankSyncFormSchema, type MilkTankSyncFormInput } from "../schemas";
import type { MilkTank } from "../types";

const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };
const REASONS = ["BUYERS_SLIP", "TYPING_ERROR", "UNKNOWN_LOSS", "OTHERS"] as const;

function toFormDefaults(tank: MilkTank): Partial<MilkTankSyncFormInput> {
  return {
    actualVolumeL: tank.currentVolumeL,
    fatPct: tank.fatPct ?? undefined,
    proteinPct: tank.proteinPct ?? undefined,
    snfPct: tank.snfPct ?? undefined,
    reason: "BUYERS_SLIP",
  };
}

/**
 * "Sync Data to Physical" drawer — Figma 734:31364 (`get_design_context`): a read-only tank
 * snapshot (gauge + info card) plus an "Adjust Milk Info" form that resolves to the audited
 * `POST /inventory/milk-tanks/:id/adjust-volume` (`AdjustMilkTankVolumePayload`) — `delta` is
 * computed here (`actualVolumeL − tank.currentVolumeL`), not typed directly, since the backend
 * wants a signed change plus a new absolute reading isn't itself a field. The 4 reason chips
 * (`BUYERS_SLIP`/`TYPING_ERROR`/`UNKNOWN_LOSS`/`OTHERS`) aren't a backend enum — `AdjustMilkTankVolumeDto`
 * only has a free-text `notes` field, so the picked reason's label is prefixed onto the typed reason
 * text rather than sent as a separate field. Fat/Protein/SNF here update the tank's `UpdateMilkTankDto`
 * fields via a follow-up call (same endpoint the form dialog PATCHes), not the audit log itself,
 * which has no composition fields.
 */
export function MilkSyncDialog({
  tank,
  onOpenChange,
}: {
  tank: MilkTank | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(tank)} onOpenChange={onOpenChange}>
      {tank ? <MilkSyncDialogBody key={tank.id} tank={tank} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function MilkSyncDialogBody({ tank, onOpenChange }: { tank: MilkTank; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("inventory.milk.sync");
  const isSellable = tank.tankType === "SELLABLE";
  const adjustVolume = useAdjustMilkTankVolume();
  const updateTank = useUpdateMilkTank();
  const pending = adjustVolume.isPending || updateTank.isPending;

  const form = useForm<MilkTankSyncFormInput>({
    resolver: zodResolver(milkTankSyncFormSchema),
    defaultValues: toFormDefaults(tank),
  });

  async function onSubmit(values: MilkTankSyncFormInput) {
    const delta = Math.round((values.actualVolumeL - tank.currentVolumeL) * 100) / 100;
    if (delta === 0) {
      toast.error(t("noChangeError"));
      return;
    }
    try {
      await adjustVolume.mutateAsync({
        id: tank.id,
        dto: { delta, activityType: "ADJUSTMENT", source: "manual", notes: `${t(`reasons.${values.reason}`)}${values.notes ? ` — ${values.notes}` : ""}` },
      });
      const compositionChanged =
        (values.fatPct ?? null) !== tank.fatPct || (values.proteinPct ?? null) !== tank.proteinPct || (values.snfPct ?? null) !== tank.snfPct;
      if (compositionChanged) {
        await updateTank.mutateAsync({ id: tank.id, dto: { fatPct: values.fatPct, proteinPct: values.proteinPct, snfPct: values.snfPct } });
      }
      toast.success(t("syncedToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[680px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[680px]"
    >
      <div className="flex items-start justify-between pb-5">
        <div className="flex flex-col gap-2">
          <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("close")}
          className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-[200px] w-[140px] shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border border-border p-3">
              <Chip variant={isSellable ? "info" : "warning"}>{isSellable ? t("badgeSellable") : t("badgeWithholding")}</Chip>
              <div className="relative h-[130px] w-[70px] overflow-hidden rounded-b-2xl border border-border bg-muted">
                <div
                  className={cn("absolute inset-x-0 bottom-0 rounded-b-2xl", isSellable ? "bg-info/70" : "bg-warning/60")}
                  style={{ height: `${Math.min(100, Math.max(0, tank.fillPct))}%` }}
                />
                <div className="absolute inset-x-1 bottom-1.5 flex flex-col items-center text-center">
                  <span className={cn("text-sm font-bold", isSellable ? "text-info" : "text-warning")}>{tank.currentVolumeL}L</span>
                  <span className="text-xs text-muted-foreground">{t("totalMilk")}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-4 rounded-xl bg-muted p-4">
              <p className="text-lg font-bold text-foreground">{tank.name}</p>
              <div className="grid grid-cols-2 gap-y-6">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-muted-foreground">{t("smartSensorId")}</span>
                  <span className="text-sm text-foreground">{tank.smartSensorId ?? "—"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-muted-foreground">{t("totalCapacity")}</span>
                  <span className="text-sm text-foreground">{t("litreValue", { value: tank.totalCapacityL })}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-muted-foreground">{t("temperature")}</span>
                  <span className="text-sm text-foreground">{tank.targetTempC != null ? `${tank.targetTempC} °C` : "—"}</span>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-bold text-muted-foreground">{t("agitationInterval")}</span>
                  <span className="text-sm text-foreground">{tank.agitationIntervalMin != null ? t("minValue", { value: tank.agitationIntervalMin }) : "—"}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">{t("adjustMilkInfo")}</div>
            <div className="flex flex-col gap-3">
              <LabeledInput
                id="actualVolumeL"
                type="number"
                min={0}
                step="0.01"
                label={t("actualMilkVolume")}
                endIcon={<span className="text-xs text-muted-foreground">{t("litre")}</span>}
                {...form.register("actualVolumeL", numberField)}
                error={form.formState.errors.actualVolumeL?.message}
              />
              <div className="grid grid-cols-3 gap-3">
                <LabeledInput id="fatPct" type="number" min={0} max={100} step="0.1" label={t("fat")} endIcon={<span className="text-xs text-muted-foreground">%</span>} {...form.register("fatPct", numberField)} />
                <LabeledInput id="proteinPct" type="number" min={0} max={100} step="0.1" label={t("protein")} endIcon={<span className="text-xs text-muted-foreground">%</span>} {...form.register("proteinPct", numberField)} />
                <LabeledInput id="snfPct" type="number" min={0} max={100} step="0.1" label={t("snf")} endIcon={<span className="text-xs text-muted-foreground">%</span>} {...form.register("snfPct", numberField)} />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold text-foreground">{t("whyTheDifference")}</p>
            <Controller
              control={form.control}
              name="reason"
              render={({ field }) => (
                <div className="flex items-center gap-4">
                  {REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => field.onChange(reason)}
                      className={cn(
                        "flex-1 rounded-lg border px-2.5 py-2 text-center text-sm transition-colors",
                        field.value === reason ? "border-primary text-foreground" : "border-input text-foreground",
                      )}
                    >
                      {t(`reasons.${reason}`)}
                    </button>
                  ))}
                </div>
              )}
            />
            <Textarea id="notes" placeholder={t("reasonPlaceholder")} className="h-20" {...form.register("notes")} />
          </div>
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-2 pt-5">
          <Button type="button" variant="secondary" className="h-[52px] flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-[52px] flex-1 rounded-xl" disabled={pending}>
            {pending ? "…" : t("syncToPhysical")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
