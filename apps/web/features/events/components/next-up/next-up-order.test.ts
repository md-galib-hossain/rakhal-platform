import { describe, expect, it } from "vitest";
import type { UpcomingEvent } from "@/features/cattle/types";
import { capNextUp, orderNextUp } from "./next-up-order";

const ev = (id: string, daysUntil: number, urgency: UpcomingEvent["urgency"] = "LATER"): UpcomingEvent => ({
  kind: "TASK",
  labelKey: "k",
  labelParams: {},
  dueAt: "2026-11-03T00:00:00.000Z",
  daysUntil,
  urgency,
  actionable: true,
  ref: { type: "TASK", id },
});

describe("next-up order and cap (RFE-187)", () => {
  it("puts overdue first, then soonest", () => {
    const out = orderNextUp([ev("a", 5), ev("b", -2, "OVERDUE"), ev("c", 1), ev("d", -9, "OVERDUE")]);
    expect(out.map((e) => e.ref.id)).toEqual(["d", "b", "c", "a"]);
  });
  it("caps at 3 and reports the overflow count", () => {
    const r = capNextUp(
      [1, 2, 3, 4, 5].map((n) => ev(String(n), n)),
      5,
    );
    expect(r.shown).toHaveLength(3);
    expect(r.overflow).toBe(true);
    expect(r.count).toBe(5);
  });
  it("has no overflow at 3 or fewer", () => {
    expect(capNextUp([ev("a", 1), ev("b", 2), ev("c", 3)], 3).overflow).toBe(false);
  });
  it("counts server-capped rows in the total", () => {
    expect(capNextUp([ev("a", 1)], 12).count).toBe(12);
  });
});
