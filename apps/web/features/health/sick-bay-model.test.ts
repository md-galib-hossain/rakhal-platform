import { describe, expect, it } from "vitest";
import { dayOfIllness, nextStepStatus, withdrawalDaysByCase, withdrawalDaysLeft } from "./sick-bay-model";

const w = (healthCaseId: string, cattleId: string, milk: number | null, meat: number | null) => ({
  healthCaseId,
  cattleId,
  milkDaysRemaining: milk,
  meatDaysRemaining: meat,
});

describe("withdrawalDaysLeft", () => {
  it("is the longer of milk and meat — when the animal is fully clear", () => {
    expect(withdrawalDaysLeft(w("c", "a", 2, 9))).toBe(9);
  });

  it("uses the one date it has", () => {
    expect(withdrawalDaysLeft(w("c", "a", null, 4))).toBe(4);
    expect(withdrawalDaysLeft(w("c", "a", 3, null))).toBe(3);
  });

  it("is null with no dates, and never negative", () => {
    expect(withdrawalDaysLeft(w("c", "a", null, null))).toBeNull();
    expect(withdrawalDaysLeft(w("c", "a", -2, -1))).toBe(0);
  });
});

describe("withdrawalDaysByCase", () => {
  it("keeps the longest withdrawal per case and skips undated ones", () => {
    const map = withdrawalDaysByCase([w("c1", "a", 2, 2), w("c1", "a", 5, null), w("c2", "b", null, null), w("c3", "c", 0, 0)]);
    expect([...map.entries()]).toEqual([
      ["c1", 5],
      ["c3", 0],
    ]);
  });
});

describe("dayOfIllness", () => {
  const now = new Date(2026, 9, 10, 15, 0);
  it("is day 1 on the report day and counts up", () => {
    expect(dayOfIllness(new Date(2026, 9, 10, 8, 0).toISOString(), now)).toBe(1);
    expect(dayOfIllness(new Date(2026, 9, 7, 8, 0).toISOString(), now)).toBe(4);
  });

  it("never goes below 1 for a start date in the future", () => {
    expect(dayOfIllness(new Date(2026, 9, 12).toISOString(), now)).toBe(1);
  });
});

describe("nextStepStatus", () => {
  const now = new Date(2026, 9, 10, 15, 0);
  it("flags a past step as overdue, today as today, later as upcoming", () => {
    expect(nextStepStatus(new Date(2026, 9, 8, 9).toISOString(), now)).toEqual({ days: -2, tone: "overdue" });
    expect(nextStepStatus(new Date(2026, 9, 10, 18).toISOString(), now)).toEqual({ days: 0, tone: "today" });
    expect(nextStepStatus(new Date(2026, 9, 13, 9).toISOString(), now)).toEqual({ days: 3, tone: "upcoming" });
  });
});
