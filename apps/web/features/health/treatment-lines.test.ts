import { describe, expect, it } from "vitest";
import type { Unit } from "@/features/inventory/types";
import type { MedicineOption } from "./api";
import { doseInStockUnit, maxWithdrawalDays, newTreatmentLine, validateTreatmentLines, type TreatmentLine } from "./treatment-lines";

const unit = (over: Partial<Unit>): Unit =>
  ({ id: "u", name: "Unit", symbol: "u", dimension: "COUNT", conversionToBase: null, isSystemDefault: true, isActive: true, farmId: null, createdAt: "", updatedAt: "", ...over }) as Unit;

const litre = unit({ id: "l", symbol: "L", name: "Litre", dimension: "VOLUME", conversionToBase: 1 });
const ml = unit({ id: "ml", symbol: "mL", name: "Millilitre", dimension: "VOLUME", conversionToBase: 0.001 });
const bottle = unit({ id: "b", symbol: "bottle", name: "Bottle", dimension: "COUNT" });

const medicine = (over: Partial<MedicineOption> = {}): MedicineOption => ({
  id: "m1",
  name: "Penicillin",
  currentStock: 10,
  unit: { id: "l", name: "Litre", symbol: "L" },
  costPerUnit: null,
  milkWithdrawalDays: null,
  meatWithdrawalDays: null,
  ...over,
});

const line = (over: Partial<TreatmentLine> = {}): TreatmentLine => ({ ...newTreatmentLine(), medicine: medicine(), doseAmount: "5", doseUnitId: "ml", ...over });

describe("doseInStockUnit", () => {
  it("converts a dose between units of one dimension", () => {
    expect(doseInStockUnit(500, ml, litre)).toBeCloseTo(0.5);
  });
  it("returns the amount unchanged when the unit is the stock unit", () => {
    expect(doseInStockUnit(3, bottle, bottle)).toBe(3);
  });
  it("returns null when COUNT units differ (no conversion exists)", () => {
    expect(doseInStockUnit(3, ml, bottle)).toBeNull();
  });
  it("returns null when a unit is unknown", () => {
    expect(doseInStockUnit(3, undefined, litre)).toBeNull();
  });
});

describe("validateTreatmentLines", () => {
  it("accepts complete lines", () => {
    expect(validateTreatmentLines([line(), line()]).ok).toBe(true);
  });
  it("rejects an empty list", () => {
    expect(validateTreatmentLines([]).ok).toBe(false);
  });
  it("names the first problem per line", () => {
    const noMedicine = line({ medicine: null });
    const noDose = line({ doseAmount: "0" });
    const noUnit = line({ doseUnitId: "" });
    const { ok, problems } = validateTreatmentLines([noMedicine, noDose, noUnit, line()]);
    expect(ok).toBe(false);
    expect(problems[noMedicine.key]).toBe("pickMedicine");
    expect(problems[noDose.key]).toBe("doseRequired");
    expect(problems[noUnit.key]).toBe("unitRequired");
    expect(Object.keys(problems)).toHaveLength(3);
  });
});

describe("maxWithdrawalDays", () => {
  it("takes the longest hold across medicines", () => {
    const lines = [line({ medicine: medicine({ milkWithdrawalDays: 3, meatWithdrawalDays: 10 }) }), line({ medicine: medicine({ milkWithdrawalDays: 5, meatWithdrawalDays: null }) })];
    expect(maxWithdrawalDays(lines)).toEqual({ milk: 5, meat: 10 });
  });
  it("is zero with no medicines picked", () => {
    expect(maxWithdrawalDays([line({ medicine: null })])).toEqual({ milk: 0, meat: 0 });
  });
});
