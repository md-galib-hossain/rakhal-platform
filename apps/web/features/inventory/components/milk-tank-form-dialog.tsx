"use client"; // form state + mutation

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Milk, MilkOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { useCreateMilkTank, useShedsForMilkTank, useUpdateMilkTank } from "../hooks/use-inventory";
import { milkTankFormSchema, type MilkTankFormInput } from "../schemas";
import type { CreateMilkTankPayload, MilkTank, MilkTankType, UpdateMilkTankPayload } from "../types";

const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

function toCreatePayload(values: MilkTankFormInput): CreateMilkTankPayload {
  return {
    name: values.name,
    tankType: values.tankType,
    totalCapacityL: values.totalCapacityL,
    currentVolumeL: values.currentVolumeL,
    fatPct: values.fatPct,
    proteinPct: values.proteinPct,
    snfPct: values.snfPct,
    smartSensorId: values.smartSensorId || undefined,
    targetTempC: values.targetTempC,
    agitationIntervalMin: values.agitationIntervalMin,
    assignedShedId: values.assignedShedId || undefined,
  };
}

/** Volume is deliberately absent here (unlike `toCreatePayload`) — edits go through the separate
 * audited `adjust-volume` endpoint (`MilkSyncDialog`), never a plain field update, mirroring
 * Medicine's `toUpdatePayload` (INV-02-style pattern) rather than FeedItem's single-shape one. */
function toUpdatePayload(values: MilkTankFormInput): UpdateMilkTankPayload {
  return {
    name: values.name,
    tankType: values.tankType,
    totalCapacityL: values.totalCapacityL,
    fatPct: values.fatPct,
    proteinPct: values.proteinPct,
    snfPct: values.snfPct,
    smartSensorId: values.smartSensorId || undefined,
    targetTempC: values.targetTempC,
    agitationIntervalMin: values.agitationIntervalMin,
    assignedShedId: values.assignedShedId || undefined,
  };
}

function toFormDefaults(tank: MilkTank | undefined): Partial<MilkTankFormInput> {
  if (!tank) return { tankType: "SELLABLE", totalCapacityL: 0, currentVolumeL: 0 };
  return {
    name: tank.name,
    tankType: tank.tankType,
    totalCapacityL: tank.totalCapacityL,
    fatPct: tank.fatPct ?? undefined,
    proteinPct: tank.proteinPct ?? undefined,
    snfPct: tank.snfPct ?? undefined,
    smartSensorId: tank.smartSensorId ?? "",
    targetTempC: tank.targetTempC ?? undefined,
    agitationIntervalMin: tank.agitationIntervalMin ?? undefined,
    assignedShedId: tank.assignedShedId ?? "",
  };
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-muted px-4 py-2.5 text-sm font-semibold text-foreground">{children}</div>;
}

function TankTypeOption({ type, selected, onSelect, label }: { type: MilkTankType; selected: boolean; onSelect: () => void; label: string }) {
  const isSellable = type === "SELLABLE";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-xl border-[1.5px] px-5 py-2.5 text-sm font-medium transition-colors",
        selected
          ? isSellable
            ? "border-info bg-info-tint text-info"
            : "border-warning bg-warning-tint text-warning"
          : "border-transparent bg-muted text-muted-foreground",
      )}
    >
      <span className={cn("flex size-7 items-center justify-center rounded-md bg-card shadow-sm", selected ? (isSellable ? "text-info" : "text-warning") : "text-muted-foreground")}>
        {isSellable ? <MilkIcon /> : <MilkOffIcon />}
      </span>
      {label}
    </button>
  );
}

function MilkIcon() {
  return <Milk className="size-[18px]" aria-hidden />;
}
function MilkOffIcon() {
  return <MilkOff className="size-[18px]" aria-hidden />;
}

/**
 * Add/Edit Milk Tank drawer — Figma "Add New Tank" (734:30564, `get_design_context`): same
 * floating-card chrome as `FeedItemFormDialog` (10px inset, 20px radius, 2px border, `arrow-right-03`
 * header icon), muted-band section headers, tank-type toggle cards. **Real gap vs the mock, flagged
 * not faked**: the "Cooling Type" select (`CreateMilkTankDto`/`UpdateMilkTankDto` have no matching
 * field at all, see `types.ts` doc comment) renders as a disabled, non-interactive field — kept for
 * layout fidelity, never submitted.
 */
export function MilkTankFormDialog({
  open,
  onOpenChange,
  tank,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tank?: MilkTank;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? <MilkTankFormDialogBody key={tank?.id ?? "create"} onOpenChange={onOpenChange} tank={tank} /> : null}
    </Sheet>
  );
}

function MilkTankFormDialogBody({ onOpenChange, tank }: { onOpenChange: (open: boolean) => void; tank?: MilkTank }) {
  const t = useTranslations("inventory.milk.form");
  const isEdit = Boolean(tank);
  const sheds = useShedsForMilkTank();
  const createTank = useCreateMilkTank();
  const updateTank = useUpdateMilkTank();
  const pending = createTank.isPending || updateTank.isPending;

  const form = useForm<MilkTankFormInput>({
    resolver: zodResolver(milkTankFormSchema),
    defaultValues: toFormDefaults(tank),
  });

  async function onSubmit(values: MilkTankFormInput) {
    try {
      if (isEdit && tank) {
        await updateTank.mutateAsync({ id: tank.id, dto: toUpdatePayload(values) });
      } else {
        await createTank.mutateAsync(toCreatePayload(values));
      }
      toast.success(isEdit ? t("updatedToast") : t("createdToast"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const tankType = useWatch({ control: form.control, name: "tankType" });

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[680px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[680px]"
    >
      <div className="flex items-start justify-between pb-5">
        <div className="flex flex-col gap-2">
          <SheetTitle className="text-xl font-bold text-foreground">{isEdit ? t("editTitle") : t("createTitle")}</SheetTitle>
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
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto py-4">
          <SectionHeader>{t("tankType")}</SectionHeader>
          <div className="flex items-center gap-2.5">
            <TankTypeOption type="SELLABLE" selected={tankType === "SELLABLE"} onSelect={() => form.setValue("tankType", "SELLABLE")} label={t("sellableTank")} />
            <TankTypeOption type="WITHHOLDING" selected={tankType === "WITHHOLDING"} onSelect={() => form.setValue("tankType", "WITHHOLDING")} label={t("withholdingTank")} />
          </div>

          <SectionHeader>{t("tankInfo")}</SectionHeader>
          <div className="flex flex-col gap-3">
            <LabeledInput id="name" label={t("tankName")} placeholder={t("tankNamePlaceholder")} {...form.register("name")} error={form.formState.errors.name?.message} />
            <div className="grid grid-cols-2 gap-3">
              <LabeledInput id="coolingType" label={t("coolingType")} value={t("coolingTypeValue")} readOnly disabled title={t("coolingTypeNote")} />
              <LabeledInput
                id="totalCapacityL"
                type="number"
                min={0}
                step="0.01"
                label={t("totalCapacity")}
                endIcon={<span className="text-xs text-muted-foreground">{t("litre")}</span>}
                {...form.register("totalCapacityL", numberField)}
                error={form.formState.errors.totalCapacityL?.message}
              />
              <LabeledInput id="smartSensorId" label={t("smartSensorId")} placeholder={t("smartSensorIdPlaceholder")} {...form.register("smartSensorId")} />
              <Controller
                control={form.control}
                name="assignedShedId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <LabeledSelectTrigger label={t("assignedShed")} placeholder={t("selectShed")} />
                    <SelectContent>
                      {(sheds.data?.items ?? []).map((shed) => (
                        <SelectItem key={shed.id} value={shed.id}>
                          {shed.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <SectionHeader>{t("calibrationSafety")}</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <LabeledInput
              id="targetTempC"
              type="number"
              step="0.1"
              label={t("targetTemperature")}
              endIcon={<span className="text-xs text-muted-foreground">°C</span>}
              {...form.register("targetTempC", numberField)}
            />
            <LabeledInput
              id="agitationIntervalMin"
              type="number"
              min={0}
              label={t("agitationInterval")}
              endIcon={<span className="text-xs text-muted-foreground">{t("min")}</span>}
              {...form.register("agitationIntervalMin", numberField)}
            />
          </div>

          <SectionHeader>{t("milkInfo")}</SectionHeader>
          <div className="flex flex-col gap-3">
            <LabeledInput
              id="currentVolumeL"
              type="number"
              min={0}
              step="0.01"
              label={t("milkVolume")}
              disabled={isEdit}
              title={isEdit ? t("milkVolumeEditHint") : undefined}
              endIcon={<span className="text-xs text-muted-foreground">{t("litre")}</span>}
              {...form.register("currentVolumeL", numberField)}
            />
            <div className="grid grid-cols-3 gap-3">
              <LabeledInput id="fatPct" type="number" min={0} max={100} step="0.1" label={t("fat")} endIcon={<span className="text-xs text-muted-foreground">%</span>} {...form.register("fatPct", numberField)} />
              <LabeledInput id="proteinPct" type="number" min={0} max={100} step="0.1" label={t("protein")} endIcon={<span className="text-xs text-muted-foreground">%</span>} {...form.register("proteinPct", numberField)} />
              <LabeledInput id="snfPct" type="number" min={0} max={100} step="0.1" label={t("snf")} endIcon={<span className="text-xs text-muted-foreground">%</span>} {...form.register("snfPct", numberField)} />
            </div>
          </div>
        </div>

        <div className="border-t border-dashed border-border" />
        <div className="flex gap-2 pt-5">
          <Button type="button" variant="secondary" className="h-[52px] flex-1 rounded-xl" onClick={() => onOpenChange(false)} disabled={pending}>
            {t("cancel")}
          </Button>
          <Button type="submit" className="h-[52px] flex-1 rounded-xl" disabled={pending}>
            {pending ? "…" : isEdit ? t("save") : t("add")}
          </Button>
        </div>
      </form>
    </SheetContent>
  );
}
