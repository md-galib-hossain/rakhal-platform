import { describe, expect, it } from "vitest";
import { buildPhaseBar, milkFigures, overviewCards, weightTrend } from "./overview-model";

const today = "2026-11-01";

describe("buildPhaseBar", () => {
  it("returns null with nothing to anchor on", () => {
    expect(buildPhaseBar({ today, dim: null, lastBreeding: null, expectedCalvingDate: null, pregnant: false })).toBeNull();
  });
  it("open cow past the VWP: calving + VWP only, today after VWP", () => {
    const bar = buildPhaseBar({ today, dim: 143, lastBreeding: null, expectedCalvingDate: null, pregnant: false })!;
    expect(bar.markers.map((m) => m.key)).toEqual(["calving", "vwp"]);
    expect(bar.markers[1].recorded).toBe(true);
    expect(bar.todayPct!).toBeGreaterThan(bar.markers[1].pct);
  });
  it("pregnant cow: all five markers, due projected, check recorded, all inside the bar", () => {
    const bar = buildPhaseBar({ today, dim: 100, lastBreeding: "2026-09-01", expectedCalvingDate: "2027-06-11", pregnant: true })!;
    expect(bar.markers.map((m) => m.key)).toEqual(["calving", "vwp", "bred", "check", "due"]);
    expect(bar.markers.find((m) => m.key === "due")!.recorded).toBe(false);
    expect(bar.markers.find((m) => m.key === "check")!.recorded).toBe(true);
    expect(bar.markers.every((m) => m.pct >= 0 && m.pct <= 100)).toBe(true);
  });
  it("bred heifer anchors on the service date and has no today tick", () => {
    const bar = buildPhaseBar({ today, dim: null, lastBreeding: "2026-10-20", expectedCalvingDate: null, pregnant: false })!;
    expect(bar.markers.map((m) => m.key)).toEqual(["bred", "check", "due"]);
    expect(bar.todayPct).toBeNull();
  });
});

describe("milkFigures / weightTrend / overviewCards", () => {
  it("sums the last 7 days and finds today", () => {
    const f = milkFigures([{ date: "2026-11-01", total_l: 11 }, { date: "2026-10-30", total_l: 9 }, { date: "2026-10-01", total_l: 50 }], today);
    expect(f).toMatchObject({ today: 11, weekTotal: 20, hasData: true });
  });
  it("has no delta with one weight", () => {
    expect(weightTrend([{ date: "2026-10-01", weight_kg: 200 }], today).delta30).toBeNull();
  });
  it("computes a 30 day delta", () => {
    expect(weightTrend([{ date: "2026-10-05", weight_kg: 216 }, { date: "2026-11-01", weight_kg: 222 }], today).delta30).toBe(6);
  });
  it("hides reproduction for a bull and milk for a heifer", () => {
    expect(overviewCards({ gender: "MALE", animalCategory: "BULL", productionStatus: null })).toEqual({ reproduction: false, milk: false });
    expect(overviewCards({ gender: "FEMALE", animalCategory: "HEIFER", productionStatus: null })).toEqual({ reproduction: true, milk: false });
  });
});
