import { describe, expect, it } from "vitest";
import { resolveWizardPeriod } from "./period";

describe("resolveWizardPeriod", () => {
  it("today compares with yesterday", () => {
    const v = resolveWizardPeriod("today", "2026-10-24")!;
    expect(v.period).toEqual({ startDate: "2026-10-24", endDate: "2026-10-24" });
    expect(v.previous).toEqual({ startDate: "2026-10-23", endDate: "2026-10-23" });
    expect(v.partial).toBe(false);
  });

  it("this week is the full Mon-Sun week, compared like-for-like while running", () => {
    // 2026-10-24 is a Saturday: week 19-25 Oct, 6 days elapsed.
    const v = resolveWizardPeriod("this_week", "2026-10-24")!;
    expect(v.period).toEqual({ startDate: "2026-10-19", endDate: "2026-10-25" });
    expect(v.current.endDate).toBe("2026-10-24");
    expect(v.previous).toEqual({ startDate: "2026-10-12", endDate: "2026-10-17" });
    expect(v.partial).toBe(true);
  });

  it("this month caps the previous month at its own length (31 Mar vs February)", () => {
    const v = resolveWizardPeriod("this_month", "2026-03-31")!;
    expect(v.period).toEqual({ startDate: "2026-03-01", endDate: "2026-03-31" });
    expect(v.previous).toEqual({ startDate: "2026-02-01", endDate: "2026-02-28" });
  });

  it("January compares with the previous December", () => {
    const v = resolveWizardPeriod("this_month", "2026-01-10")!;
    expect(v.previous).toEqual({ startDate: "2025-12-01", endDate: "2025-12-10" });
  });

  it("this year compares with last year to date", () => {
    const v = resolveWizardPeriod("this_year", "2026-10-24")!;
    expect(v.period).toEqual({ startDate: "2026-01-01", endDate: "2026-12-31" });
    expect(v.previous).toEqual({ startDate: "2025-01-01", endDate: "2025-10-24" });
  });

  it("custom compares with the same-length window right before, never truncated", () => {
    const v = resolveWizardPeriod("custom", "2026-10-24", { startDate: "2026-08-01", endDate: "2026-08-10" })!;
    expect(v.previous).toEqual({ startDate: "2026-07-22", endDate: "2026-07-31" });
    expect(v.partial).toBe(false);
  });

  it("returns null for an unusable custom range", () => {
    expect(resolveWizardPeriod("custom", "2026-10-24")).toBeNull();
    expect(resolveWizardPeriod("custom", "2026-10-24", { startDate: "2026-02-31", endDate: "2026-03-02" })).toBeNull();
    expect(resolveWizardPeriod("custom", "2026-10-24", { startDate: "2026-03-05", endDate: "2026-03-02" })).toBeNull();
  });
});
