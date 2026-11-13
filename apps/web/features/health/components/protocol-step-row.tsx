"use client"; // RHF-controlled row with a medicine search-select and a unit select

import { useEffect, useMemo } from "react";
import { Controller, useWatch, type UseFormReturn } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Trash2 } from "lucide-react";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@rakhal/ui/ui/select";
import { useUnits } from "@/features/inventory/hooks/use-inventory";
import type { Unit } from "@/features/inventory/types";
import { searchMedicines, type MedicineOption } from "../api";
import type { CreateHealthPlanFormInput } from "../schemas";
import { MedicinePicker } from "./medicine-picker";

const numberField = { setValueAs: (v: string) => (v === "" ? undefined : Number(v)) };

/** Units a dose of `medicineUnit` can be written in: the medicine's own unit, plus (weight/volume only) any unit of the
 * same dimension with a base conversion. COUNT units (bottle, dose, pcs…) never convert into each other. */
export function compatibleDoseUnits(units: Unit[], medicineUnit: Unit | undefined): Unit[] {
  if (!medicineUnit) return [];
  return units.filter(
    (u) =>
      u.id === medicineUnit.id ||
      (medicineUnit.dimension !== "COUNT" && u.dimension === medicineUnit.dimension && u.conversionToBase != null && medicineUnit.conversionToBase != null),
  );
}

interface ProtocolStepRowProps {
  form: UseFormReturn<CreateHealthPlanFormInput>;
  index: number;
  canRemove: boolean;
  onRemove: () => void;
}

/** One day of the Action Sequence Builder: when (day + optional time), what (an inventory medicine), how much (dose
 * amount + a unit that converts to the medicine's stock unit). The medicine is picked, never typed, so the dose can be
 * unit-checked and the protocol stock-checked when it is applied. */
export function ProtocolStepRow({ form, index, canRemove, onRemove }: ProtocolStepRowProps) {
  const t = useTranslations("health.healthPlan.createDialog");
  const row = useWatch({ control: form.control, name: `steps.${index}` });
  const errors = form.formState.errors.steps?.[index];
  const { data: units = [] } = useUnits();

  // A step saved before protocols v2 (or loaded for edit) carries the medicine id but not its unit/stock — look them up once.
  const needsLookup = Boolean(row?.medicineId && row.medicineUnitId == null && row.medicineName);
  const { data: lookup } = useQuery({
    queryKey: ["health-step-medicine", row?.medicineId],
    queryFn: () => searchMedicines(row!.medicineName),
    enabled: needsLookup,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (!needsLookup || !lookup) return;
    const found = lookup.items.find((m) => m.id === row?.medicineId);
    if (!found) return;
    form.setValue(`steps.${index}.medicineUnitId`, found.unit.id);
    form.setValue(`steps.${index}.medicineUnitSymbol`, found.unit.symbol);
    form.setValue(`steps.${index}.medicineStock`, found.currentStock);
    if (!form.getValues(`steps.${index}.doseUnitId`)) form.setValue(`steps.${index}.doseUnitId`, found.unit.id);
  }, [needsLookup, lookup, form, index, row?.medicineId]);

  const medicineUnit = units.find((u) => u.id === row?.medicineUnitId);
  const doseUnits = useMemo(() => compatibleDoseUnits(units, medicineUnit), [units, medicineUnit]);

  const pickerValue: MedicineOption | null = row?.medicineId
    ? {
        id: row.medicineId,
        name: row.medicineName,
        currentStock: row.medicineStock ?? 0,
        unit: { id: row.medicineUnitId ?? "", name: "", symbol: row.medicineUnitSymbol ?? "" },
        costPerUnit: null,
        milkWithdrawalDays: null,
        meatWithdrawalDays: null,
      }
    : null;

  function pickMedicine(medicine: MedicineOption | null) {
    const prefix = `steps.${index}` as const;
    form.setValue(`${prefix}.medicineId`, medicine?.id ?? "", { shouldValidate: form.formState.isSubmitted });
    form.setValue(`${prefix}.medicineName`, medicine?.name ?? "", { shouldValidate: form.formState.isSubmitted });
    form.setValue(`${prefix}.medicineUnitId`, medicine?.unit.id);
    form.setValue(`${prefix}.medicineUnitSymbol`, medicine?.unit.symbol);
    form.setValue(`${prefix}.medicineStock`, medicine?.currentStock);
    // A new medicine resets the dose unit to its own stock unit — the old pick may not convert.
    form.setValue(`${prefix}.doseUnitId`, medicine?.unit.id ?? "");
  }

  const outOfStock = row?.medicineId != null && row.medicineId !== "" && row.medicineStock !== undefined && row.medicineStock <= 0;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border p-3">
      <div className="flex items-start gap-2">
        <div className="w-[88px] shrink-0">
          <LabeledInput id={`steps.${index}.dayNumber`} type="number" min={1} label={t("day")} {...form.register(`steps.${index}.dayNumber`, numberField)} error={errors?.dayNumber?.message} />
        </div>
        <div className="flex-1">
          <LabeledInput id={`steps.${index}.timeOfDay`} type="time" label={t("timeOptional")} {...form.register(`steps.${index}.timeOfDay`)} error={errors?.timeOfDay?.message} />
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={t("removeDay")}
          className="mt-3 flex size-6 shrink-0 items-center justify-center rounded text-destructive transition-opacity hover:opacity-70 disabled:opacity-30"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{t("medicine")}</p>
        <MedicinePicker compact value={pickerValue} onValueChange={pickMedicine} />
        {errors?.medicineId?.message ? <p className="text-sm text-destructive">{errors.medicineId.message}</p> : null}
        {row?.medicineId && row.medicineStock !== undefined ? (
          <p className={outOfStock ? "text-xs font-medium text-destructive" : "text-xs text-muted-foreground"}>
            {outOfStock ? t("outOfStockHint") : t("stockLine", { stock: row.medicineStock, unit: row.medicineUnitSymbol ?? "" })}
          </p>
        ) : null}
      </div>

      <div className="flex items-start gap-2">
        <div className="flex-1">
          <LabeledInput id={`steps.${index}.doseAmount`} type="number" min={0} step="any" label={t("dose")} {...form.register(`steps.${index}.doseAmount`, numberField)} error={errors?.doseAmount?.message} />
        </div>
        <div className="flex-1">
          <Controller
            control={form.control}
            name={`steps.${index}.doseUnitId`}
            render={({ field }) => (
              // "" (not undefined) keeps Radix Select controlled from the first render, so a later default (the picked
              // medicine's own unit) is actually shown; "" still renders the placeholder.
              <Select value={field.value ?? ""} onValueChange={field.onChange} disabled={doseUnits.length === 0}>
                <LabeledSelectTrigger label={t("doseUnit")} placeholder={row?.medicineId ? t("doseUnitPlaceholder") : t("pickMedicineFirst")} aria-label={t("doseUnit")} />
                <SelectContent>
                  {doseUnits.map((u) => (
                    <SelectItem key={u.id} value={u.id}>
                      {u.symbol} · {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors?.doseUnitId?.message ? <p className="mt-1 text-sm text-destructive">{errors.doseUnitId.message}</p> : null}
        </div>
      </div>
    </div>
  );
}
