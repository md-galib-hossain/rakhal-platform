"use client"; // list state lives in the parent form; this renders pickers, inputs and unit selects

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { LabeledInput, LabeledSelectTrigger } from "@/components/ui/labeled-field";
import { Select, SelectContent, SelectItem } from "@/components/ui/select";
import { useUnits } from "@/features/inventory/hooks/use-inventory";
import type { MedicineOption } from "../api";
import { MEDICINE_ROUTES } from "../types";
import {
  doseInStockUnit,
  MAX_TREATMENT_LINES,
  newTreatmentLine,
  type TreatmentLine,
  type TreatmentLineProblem,
} from "../treatment-lines";
import { MedicinePicker } from "./medicine-picker";
import { compatibleDoseUnits } from "./protocol-step-row";

interface TreatmentLinesProps {
  lines: TreatmentLine[];
  onChange: (lines: TreatmentLine[]) => void;
  /** Per-line problems to show (set after the first failed save); omit before then so a fresh form is not red. */
  problems?: Record<string, TreatmentLineProblem>;
  /** How many animals get this treatment — multiplies the dose when checking it against stock. Default 1. */
  animalCount?: number;
  disabled?: boolean;
}

/** The "what was given" part of every treatment form: one card per medicine (inventory picker, dose amount, dose unit as
 * a dropdown limited to units that convert to the medicine's stock unit, route), plus "Add another medicine". The unit is
 * picked, never typed, so the backend can convert the dose to stock units when it deducts. */
export function TreatmentLines({ lines, onChange, problems, animalCount = 1, disabled }: TreatmentLinesProps) {
  const t = useTranslations("health.treatmentLines");

  function update(key: string, patch: Partial<TreatmentLine>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  return (
    <div className="flex flex-col gap-3">
      {lines.map((line, index) => (
        <TreatmentLineCard
          key={line.key}
          line={line}
          index={index}
          problem={problems?.[line.key]}
          animalCount={animalCount}
          canRemove={lines.length > 1}
          disabled={disabled}
          onPatch={(patch) => update(line.key, patch)}
          onRemove={() => onChange(lines.filter((l) => l.key !== line.key))}
        />
      ))}
      <Button
        type="button"
        variant="outline"
        className="w-full border-dashed"
        disabled={disabled || lines.length >= MAX_TREATMENT_LINES}
        onClick={() => onChange([...lines, newTreatmentLine(lines[lines.length - 1]?.route)])}
      >
        <Plus className="size-4" aria-hidden />
        {t("addMedicine")}
      </Button>
    </div>
  );
}

function TreatmentLineCard({
  line,
  index,
  problem,
  animalCount,
  canRemove,
  disabled,
  onPatch,
  onRemove,
}: {
  line: TreatmentLine;
  index: number;
  problem: TreatmentLineProblem | undefined;
  animalCount: number;
  canRemove: boolean;
  disabled?: boolean;
  onPatch: (patch: Partial<TreatmentLine>) => void;
  onRemove: () => void;
}) {
  const t = useTranslations("health.treatmentLines");
  const tRoute = useTranslations("health.caseSheet.logTreatment.route");
  const { data: units = [] } = useUnits();

  const stockUnit = units.find((u) => u.id === line.medicine?.unit.id);
  const doseUnits = useMemo(() => compatibleDoseUnits(units, stockUnit), [units, stockUnit]);
  const doseUnit = units.find((u) => u.id === line.doseUnitId);

  const amount = Number(line.doseAmount);
  const needed = amount > 0 ? doseInStockUnit(amount * animalCount, doseUnit, stockUnit) : null;
  const stock = line.medicine?.currentStock;
  const outOfStock = line.medicine != null && (stock ?? 0) <= 0;
  const short = needed != null && stock != null && stock > 0 && needed > stock;

  function pickMedicine(medicine: MedicineOption | null) {
    // A new medicine resets the unit to its own stock unit — the previous pick may not convert.
    onPatch({ medicine, doseUnitId: medicine?.unit.id ?? "" });
  }

  return (
    <div className={cn("flex flex-col gap-3 rounded-xl border p-3", problem ? "border-destructive/60" : "border-border")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-foreground">{t("medicineN", { n: index + 1 })}</p>
        {canRemove ? (
          <button
            type="button"
            onClick={onRemove}
            disabled={disabled}
            aria-label={t("remove", { n: index + 1 })}
            className="flex size-6 items-center justify-center rounded text-destructive transition-opacity hover:opacity-70 disabled:opacity-30"
          >
            <Trash2 className="size-4" aria-hidden />
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <MedicinePicker compact value={line.medicine} onValueChange={pickMedicine} disabled={disabled} />
        {line.medicine ? (
          <p className={cn("text-xs", outOfStock ? "font-medium text-destructive" : "text-muted-foreground")}>
            {outOfStock ? t("outOfStock") : t("stockLine", { stock: line.medicine.currentStock, unit: line.medicine.unit.symbol })}
          </p>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <LabeledInput
          id={`${line.key}-dose`}
          type="number"
          inputMode="decimal"
          min={0}
          step="any"
          label={t("dose")}
          value={line.doseAmount}
          disabled={disabled}
          onChange={(e) => onPatch({ doseAmount: e.target.value })}
        />
        {/* "" (not undefined) keeps the Radix Select controlled, so the medicine's default unit shows once picked. */}
        <Select value={line.doseUnitId} onValueChange={(v) => onPatch({ doseUnitId: v })} disabled={disabled || doseUnits.length === 0}>
          <LabeledSelectTrigger
            label={t("doseUnit")}
            placeholder={line.medicine ? t("doseUnitPlaceholder") : t("pickMedicineFirst")}
            aria-label={t("doseUnit")}
          />
          <SelectContent>
            {doseUnits.map((u) => (
              <SelectItem key={u.id} value={u.id}>
                {u.symbol} · {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {short ? (
        <p className="text-xs font-medium text-warning">
          {t("notEnoughStock", { needed: Math.round(needed * 100) / 100, stock: stock ?? 0, unit: line.medicine?.unit.symbol ?? "" })}
        </p>
      ) : null}

      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{t("route")}</p>
        <div className="grid grid-cols-4 gap-2">
          {MEDICINE_ROUTES.map((r) => (
            <button
              key={r}
              type="button"
              disabled={disabled}
              aria-pressed={line.route === r}
              onClick={() => onPatch({ route: r })}
              className={cn(
                "rounded-md border px-2 py-1.5 text-sm font-semibold transition-colors",
                line.route === r ? "border-primary text-primary" : "border-border text-muted-foreground hover:border-foreground/30",
              )}
            >
              {tRoute(r)}
            </button>
          ))}
        </div>
      </div>

      {problem ? <p className="text-sm text-destructive">{t(`problem.${problem}`)}</p> : null}
    </div>
  );
}
