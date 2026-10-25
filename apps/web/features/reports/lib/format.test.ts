import { describe, expect, it } from "vitest";
import type { MetricValue } from "../types";
import { formatMetricNumber, formatMetricValue, formatPercentChange, NOT_APPLICABLE_DASH, periodLabel, unitLabelKey } from "./format";

// Stub translator: returns the key so the test asserts WHICH text is chosen, not its wording.
const t = (key: string) => `«${key}»`;

describe("formatMetricValue", () => {
  it("formats values with their unit", () => {
    expect(formatMetricValue({ state: "value", value: 1234.5, unit: "L" }, "en", t)).toBe("1,234.5 «reports.units.L»");
    expect(formatMetricValue({ state: "value", value: 12, unit: "kg" }, "en", t)).toBe("12 «reports.units.kg»");
    expect(formatMetricValue({ state: "value", value: 33.33, unit: "%" }, "en", t)).toBe("33.33%");
    expect(formatMetricValue({ state: "value", value: 7, unit: "cow-days" }, "en", t)).toBe("7 «reports.units.cowDays»");
    expect(formatMetricValue({ state: "value", value: 3, unit: "days" }, "en", t)).toBe("3 «reports.units.days»");
    expect(formatMetricValue({ state: "value", value: 5, unit: "cows" }, "en", t)).toBe("5 «reports.units.cows»");
    expect(formatMetricValue({ state: "value", value: 5, unit: "count" }, "en", t)).toBe("5");
  });
  it("shows the taka sign for BDT and BDT-per units", () => {
    expect(formatMetricValue({ state: "value", value: 45000, unit: "BDT" }, "en", t)).toBe("৳45,000");
    expect(formatMetricValue({ state: "value", value: 12.5, unit: "BDT/cow-day" }, "en", t)).toBe("৳12.5 «reports.units.perCowDay»");
    expect(formatMetricValue({ state: "value", value: 4.25, unit: "BDT/L" }, "bn", t)).toContain("৳4.25");
  });
  it("uses Latin digits in bn and lakh grouping", () => {
    expect(formatMetricValue({ state: "value", value: 119000, unit: "BDT" }, "bn", t)).toBe("৳1,19,000");
  });
  it("rounds float noise to 2 decimals", () => {
    expect(formatMetricValue({ state: "value", value: 0.1 + 0.2, unit: "kg" }, "en", t)).toBe("0.3 «reports.units.kg»");
  });
  it("renders a genuine zero as 0, not as a missing text", () => {
    expect(formatMetricValue({ state: "value", value: 0, unit: "L" }, "en", t)).toBe("0 «reports.units.L»");
  });
  it("falls back to the raw unit when unknown", () => {
    expect(formatMetricValue({ state: "value", value: 2, unit: "pcs" }, "en", t)).toBe("2 pcs");
  });
  it("unit override wins", () => {
    expect(formatMetricValue({ state: "value", value: 2, unit: "L" }, "en", t, "kg")).toBe("2 «reports.units.kg»");
  });

  const nonValues: MetricValue[] = [
    { state: "missing", reason: "reports.milk.no_submitted_rows" },
    { state: "not_calculated", reason: "x" },
    { state: "not_applicable" },
  ];
  it("NEVER renders 0 (or a number) for a non-value state", () => {
    for (const v of nonValues) {
      const out = formatMetricValue(v, "en", t);
      expect(out).not.toMatch(/\d/);
      expect(out).not.toBe("0");
    }
    expect(formatMetricValue(nonValues[0], "en", t)).toBe("«reports.states.missing»");
    expect(formatMetricValue(nonValues[1], "en", t)).toBe("«reports.states.not_calculated»");
    expect(formatMetricValue(nonValues[2], "en", t)).toBe(NOT_APPLICABLE_DASH);
  });
  it("does the same for the number-only formatter", () => {
    for (const v of nonValues) expect(formatMetricNumber(v, "en", t)).not.toMatch(/\d/);
    expect(formatMetricNumber({ state: "value", value: 1500, unit: "L" }, "en", t)).toBe("1,500");
  });
  it("never prints NaN/Infinity for a corrupt value", () => {
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY]) {
      const out = formatMetricValue({ state: "value", value: bad, unit: "L" }, "en", t);
      expect(out).toBe("«reports.states.not_calculated»");
      expect(formatMetricNumber({ state: "value", value: bad, unit: "L" }, "en", t)).not.toMatch(/NaN|Infinity/);
    }
  });
});

describe("formatPercentChange", () => {
  it("null / undefined / NaN is an em dash, never 0%", () => {
    expect(formatPercentChange(null)).toBe("—");
    expect(formatPercentChange(undefined)).toBe("—");
    expect(formatPercentChange(Number.NaN)).toBe("—");
    expect(formatPercentChange(Number.POSITIVE_INFINITY)).toBe("—");
  });
  it("signs and rounds to one decimal", () => {
    expect(formatPercentChange(12.54)).toBe("+12.5%");
    expect(formatPercentChange(-3)).toBe("−3%");
    expect(formatPercentChange(0)).toBe("0%");
    expect(formatPercentChange(0.04)).toBe("0%");
  });
});

describe("periodLabel / unitLabelKey", () => {
  it("renders a single day and a range from farm-local dates (no timezone shift)", () => {
    expect(periodLabel({ startDate: "2026-10-05", endDate: "2026-10-05" }, "en")).toBe("Oct 5, 2026");
    expect(periodLabel({ startDate: "2026-10-01", endDate: "2026-10-31" }, "en")).toBe("Oct 1, 2026 – Oct 31, 2026");
  });
  it("falls back to the raw strings on bad input", () => {
    expect(periodLabel({ startDate: "x", endDate: "y" }, "en")).toBe("x – y");
  });
  it("maps every backend unit to a key or intentionally none", () => {
    expect(unitLabelKey("cow-days")).toBe("reports.units.cowDays");
    expect(unitLabelKey("%")).toBeNull();
    expect(unitLabelKey("BDT")).toBeNull();
    expect(unitLabelKey("unknown")).toBeNull();
  });
});
