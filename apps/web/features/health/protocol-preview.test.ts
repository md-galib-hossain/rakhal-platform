import { describe, expect, it } from "vitest";
import { buildProtocolPreview, stepDate, suggestProtocols } from "./protocol-preview";
import type { HealthPlanListItem, HealthPlanStep } from "./types";

const ymd = (d: Date | null) => (d ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}` : null);

function step(dayNumber: number, extra: Partial<HealthPlanStep> = {}): HealthPlanStep {
  return {
    id: `s${dayNumber}`,
    dayNumber,
    title: `Day ${dayNumber}`,
    actionType: "MEDICINE",
    medicineId: null,
    medicineName: null,
    doseAmount: null,
    doseUnit: null,
    route: null,
    instruction: null,
    estimatedTime: null,
    milkWithdrawalDays: null,
    meatWithdrawalDays: null,
    isRequired: true,
    ...extra,
  };
}

function plan(id: string, condition: HealthPlanListItem["condition"]): HealthPlanListItem {
  return {
    id,
    name: id,
    category: "TREATMENT",
    planType: "MEDICAL",
    description: null,
    diagnosis: null,
    condition,
    cycleLengthDays: 5,
    totalActionSteps: 1,
    isTemplate: false,
    steps: [],
    stats: { kind: "TREATMENT", appliedTo: 0, inProgress: 0, recovered: null, mortality: null, recoveryRate: null, completed: null, due: null, coverageRate: null, stepsDue: 0, stepsOverdue: 0, nextDueDate: null },
  };
}

describe("stepDate", () => {
  it("puts day 1 on the start date and day N N-1 days later (the backend rule)", () => {
    expect(ymd(stepDate("2026-10-10", 1))).toBe("2026-10-10");
    expect(ymd(stepDate("2026-10-10", 5))).toBe("2026-10-14");
  });

  it("rolls over month ends", () => {
    expect(ymd(stepDate("2026-10-30", 4))).toBe("2026-11-02");
  });

  it("never goes before the start for day 0", () => {
    expect(ymd(stepDate("2026-10-10", 0))).toBe("2026-10-10");
  });
});

describe("buildProtocolPreview", () => {
  const now = new Date(2026, 9, 10, 9, 0); // 10 Oct 2026

  it("dates every step, earliest first, and reports the span", () => {
    const preview = buildProtocolPreview([step(5), step(1), step(3)], "2026-10-10", now);
    expect(preview.rows.map((r) => ymd(r.date))).toEqual(["2026-10-10", "2026-10-12", "2026-10-14"]);
    expect(preview.rows.map((r) => r.daysFromToday)).toEqual([0, 2, 4]);
    expect(preview.totalDays).toBe(5);
  });

  it("works out when milk and meat are safe again from the latest-ending step", () => {
    const preview = buildProtocolPreview(
      [step(1, { milkWithdrawalDays: 3, meatWithdrawalDays: 10 }), step(3, { milkWithdrawalDays: 4 })],
      "2026-10-10",
      now,
    );
    expect(ymd(preview.withdrawal.milkUntil)).toBe("2026-10-16"); // 12 Oct + 4
    expect(ymd(preview.withdrawal.meatUntil)).toBe("2026-10-20"); // 10 Oct + 10
  });

  it("has no withdrawal when no step gives a withdrawing medicine", () => {
    const preview = buildProtocolPreview([step(1), step(2, { milkWithdrawalDays: 0 })], "2026-10-10", now);
    expect(preview.withdrawal).toEqual({ milkUntil: null, meatUntil: null });
  });

  it("lists the first step's four reminder days, marking the ones already past", () => {
    const preview = buildProtocolPreview([step(1)], "2026-10-12", now); // first step in 2 days
    expect(preview.firstStepReminders.map((r) => [r.daysBefore, r.willFire])).toEqual([
      [7, false],
      [3, false],
      [1, true],
      [0, true],
    ]);
  });

  it("copes with a protocol that has no steps", () => {
    const preview = buildProtocolPreview([], "2026-10-10", now);
    expect(preview).toMatchObject({ rows: [], firstDate: null, lastDate: null, totalDays: 0, firstStepReminders: [] });
  });
});

describe("suggestProtocols", () => {
  const plans = [plan("a", null), plan("b", "MASTITIS"), plan("c", "LAMENESS"), plan("d", "MASTITIS")];

  it("puts protocols tagged with the case's condition first, keeping the order inside each group", () => {
    const out = suggestProtocols(plans, "MASTITIS");
    expect(out.map((s) => [s.plan.id, s.matches])).toEqual([
      ["b", true],
      ["d", true],
      ["a", false],
      ["c", false],
    ]);
  });

  it("flags nothing and keeps the order when the case has no condition", () => {
    const out = suggestProtocols(plans, null);
    expect(out.map((s) => s.plan.id)).toEqual(["a", "b", "c", "d"]);
    expect(out.some((s) => s.matches)).toBe(false);
  });
});
