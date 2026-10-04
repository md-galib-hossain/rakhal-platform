import type { Unit } from "@/features/inventory/types";
import type { MedicineOption } from "./api";
import type { MedicineRoute } from "./types";

/** One medicine given in a single treatment: what, how much (amount + a unit that converts to the medicine's stock
 * unit) and how. The treatment forms hold a list of these so several medicines go in with one save. */
export interface TreatmentLine {
  key: string;
  medicine: MedicineOption | null;
  doseAmount: string;
  doseUnitId: string;
  route: MedicineRoute;
}

export const MAX_TREATMENT_LINES = 10;

export type TreatmentLineProblem = "pickMedicine" | "doseRequired" | "unitRequired";

let counter = 0;

export function newTreatmentLine(route: MedicineRoute = "IM"): TreatmentLine {
  counter += 1;
  return { key: `line-${counter}`, medicine: null, doseAmount: "", doseUnitId: "", route };
}

/** The dose in the medicine's own stock unit, or null when it cannot be worked out (missing unit / no conversion). */
export function doseInStockUnit(amount: number, doseUnit: Unit | undefined, stockUnit: Unit | undefined): number | null {
  if (!doseUnit || !stockUnit) return null;
  if (doseUnit.id === stockUnit.id) return amount;
  if (doseUnit.conversionToBase == null || stockUnit.conversionToBase == null) return null;
  return (amount * doseUnit.conversionToBase) / stockUnit.conversionToBase;
}

/** First thing wrong with a line, or null when it can be submitted. */
export function treatmentLineProblem(line: TreatmentLine): TreatmentLineProblem | null {
  if (!line.medicine) return "pickMedicine";
  if (!(Number(line.doseAmount) > 0)) return "doseRequired";
  if (!line.doseUnitId) return "unitRequired";
  return null;
}

/** Pairs each line with its problem; `ok` when there is at least one line and every line can be submitted. */
export function validateTreatmentLines(lines: TreatmentLine[]): { ok: boolean; problems: Record<string, TreatmentLineProblem> } {
  const problems: Record<string, TreatmentLineProblem> = {};
  for (const line of lines) {
    const problem = treatmentLineProblem(line);
    if (problem) problems[line.key] = problem;
  }
  return { ok: lines.length > 0 && Object.keys(problems).length === 0, problems };
}

/** Longest milk / meat withdrawal among the picked medicines (days; 0 when none), for the "withholding" preview. */
export function maxWithdrawalDays(lines: TreatmentLine[]): { milk: number; meat: number } {
  let milk = 0;
  let meat = 0;
  for (const line of lines) {
    milk = Math.max(milk, line.medicine?.milkWithdrawalDays ?? 0);
    meat = Math.max(meat, line.medicine?.meatWithdrawalDays ?? 0);
  }
  return { milk, meat };
}
