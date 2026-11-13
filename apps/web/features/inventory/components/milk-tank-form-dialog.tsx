"use client"; // form state + mutation

import { useId } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ArrowRightToLine, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Button } from "@rakhal/ui/ui/button";
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

function toFormDefaults(tank: MilkTank | undefined, defaultTankType: MilkTankType): Partial<MilkTankFormInput> {
  if (!tank) return { tankType: defaultTankType, totalCapacityL: 0, currentVolumeL: 0 };
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

function VisualTankTypeCard({
  type,
  selected,
  onSelect,
  title,
  description,
  badgeLabel,
}: {
  type: MilkTankType;
  selected: boolean;
  onSelect: () => void;
  title: string;
  description: string;
  badgeLabel: string;
}) {
  const isSellable = type === "SELLABLE";
  const rawId = useId();
  const clipId = `dialog-mini-bottle-${rawId.replace(/:/g, "")}`;

  // Mini milk bottle silhouette path
  const bottlePath =
    "M 26 10 L 26 19 C 26 30 6 30 6 42 L 6 122 C 6 130 13 134 19 134 L 61 134 C 67 134 74 130 74 122 L 74 42 C 74 30 54 30 54 19 L 54 10 Z";

  // Wavy liquid surface
  const wavePath = "M 0 68 C 20 71, 55 63, 80 67 L 80 140 L 0 140 Z";

  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "group relative flex flex-1 cursor-pointer items-center gap-3.5 overflow-hidden rounded-2xl border-2 p-3.5 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2",
        selected
          ? isSellable
            ? "border-info bg-info-tint/30 ring-2 ring-info/30 dark:bg-info-tint/10 shadow-sm"
            : "border-warning bg-warning-tint/30 ring-2 ring-warning/30 dark:bg-warning-tint/10 shadow-sm"
          : "border-border/80 bg-card hover:border-foreground/30 hover:bg-muted/40 hover:-translate-y-0.5",
      )}
    >
      {/* Non-cropping diagonal corner ribbon badge in top-right */}
      <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 overflow-hidden rounded-tr-2xl">
        <div
          className={cn(
            "absolute right-[-28px] top-[10px] w-[95px] rotate-45 py-0.5 text-center text-xs font-bold tracking-wide shadow-2xs",
            isSellable ? "bg-info-tint text-info" : "bg-warning-tint text-warning",
          )}
        >
          {badgeLabel}
        </div>
      </div>

      {/* Mini Visual Milk Container on the Left */}
      <div className="relative flex h-[92px] w-[54px] shrink-0 items-center justify-center transition-transform duration-200 group-hover:scale-105">
        <svg
          viewBox="0 0 80 140"
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
          shapeRendering="geometricPrecision"
          aria-hidden="true"
        >
          <defs>
            <clipPath id={clipId}>
              <path d={bottlePath} />
            </clipPath>
            <linearGradient id={`dialog-cap-grad-${rawId.replace(/:/g, "")}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#F1F3F6" />
              <stop offset="100%" stopColor="#E5E8EC" />
            </linearGradient>
          </defs>

          {/* Light Milky Bottle Backdrop */}
          <path
            d={bottlePath}
            style={{ fill: "#F5F6F8", stroke: "#E2E6EA" }}
            strokeWidth="1.5"
          />

          {/* Liquid wavy fill */}
          <g clipPath={`url(#${clipId})`}>
            <path
              d={wavePath}
              style={{ fill: isSellable ? "#A5C9FF" : "#FDE68A" }}
            />
          </g>

          {/* Crisp Bottle outline */}
          <path
            d={bottlePath}
            fill="none"
            style={{ stroke: "#E2E6EA" }}
            strokeWidth="1.5"
          />

          {/* Realistic Rounded Milk Bottle Rim resting on top */}
          <rect
            x="22"
            y="3"
            width="36"
            height="8"
            rx="4"
            fill={`url(#dialog-cap-grad-${rawId.replace(/:/g, "")})`}
            style={{ stroke: "#E2E6EA" }}
            strokeWidth="1.5"
          />
        </svg>
      </div>

      {/* Info & Radio on the Right with clean padding from the ribbon */}
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 pr-8">
        <div className="flex items-center gap-2">
          {/* Custom radio/check badge */}
          <div
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
              selected
                ? isSellable
                  ? "border-info bg-info text-white"
                  : "border-warning bg-warning text-white"
                : "border-muted-foreground/40 bg-background group-hover:border-foreground/60",
            )}
          >
            {selected ? <Check className="size-3 stroke-[3]" aria-hidden /> : null}
          </div>
          <span className="truncate text-sm font-bold text-foreground sm:text-base">{title}</span>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{description}</p>
      </div>
    </button>
  );
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
  defaultTankType = "SELLABLE",
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tank?: MilkTank;
  /** Pre-selects the tank-type toggle on create — e.g. opened from a WITHHOLDING row's
   * "Add new tank" dropdown item. Ignored when editing (`tank` set). */
  defaultTankType?: MilkTankType;
  /** Fires with the newly created tank after a successful create (not on edit) — lets a caller
   * like `MilkLogTable`'s per-row picker auto-select the tank it just created. */
  onCreated?: (tank: MilkTank) => void;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      {open ? (
        <MilkTankFormDialogBody
          key={tank?.id ?? "create"}
          onOpenChange={onOpenChange}
          tank={tank}
          defaultTankType={defaultTankType}
          onCreated={onCreated}
        />
      ) : null}
    </Sheet>
  );
}

function MilkTankFormDialogBody({
  onOpenChange,
  tank,
  defaultTankType,
  onCreated,
}: {
  onOpenChange: (open: boolean) => void;
  tank?: MilkTank;
  defaultTankType: MilkTankType;
  onCreated?: (tank: MilkTank) => void;
}) {
  const t = useTranslations("inventory.milk.form");
  const isEdit = Boolean(tank);
  const sheds = useShedsForMilkTank();
  const createTank = useCreateMilkTank();
  const updateTank = useUpdateMilkTank();
  const pending = createTank.isPending || updateTank.isPending;

  const form = useForm<MilkTankFormInput>({
    resolver: zodResolver(milkTankFormSchema),
    defaultValues: toFormDefaults(tank, defaultTankType),
  });

  async function onSubmit(values: MilkTankFormInput) {
    try {
      if (isEdit && tank) {
        await updateTank.mutateAsync({ id: tank.id, dto: toUpdatePayload(values) });
      } else {
        const created = await createTank.mutateAsync(toCreatePayload(values));
        onCreated?.(created);
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
        <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
          <SectionHeader>{t("tankType")}</SectionHeader>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2" role="radiogroup" aria-label={t("tankType")}>
            <VisualTankTypeCard
              type="SELLABLE"
              selected={tankType === "SELLABLE"}
              onSelect={() => form.setValue("tankType", "SELLABLE")}
              title={t("sellableTank")}
              description={t("sellableDesc")}
              badgeLabel={t("badgeSellable")}
            />
            <VisualTankTypeCard
              type="WITHHOLDING"
              selected={tankType === "WITHHOLDING"}
              onSelect={() => form.setValue("tankType", "WITHHOLDING")}
              title={t("withholdingTank")}
              description={t("withholdingDesc")}
              badgeLabel={t("badgeWithholding")}
            />
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
