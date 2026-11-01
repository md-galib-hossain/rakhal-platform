import { describe, expect, it } from "vitest";
import { quickActionsFor, type QuickActionFacts } from "./quick-actions";

const allow = () => true;
const cow = (over: Partial<QuickActionFacts> = {}): QuickActionFacts => ({
  gender: "FEMALE",
  animalCategory: "COW",
  herdStatus: "ACTIVE",
  deletedAt: null,
  productionStatus: "MILKING",
  reproductiveStatus: "OPEN",
  dim: 100,
  ...over,
});

describe("quickActionsFor (05 §3.4)", () => {
  it("open cow: heat, service, weight", () => {
    expect(quickActionsFor(cow(), allow)).toEqual(["HEAT", "SERVICE", "WEIGHT"]);
  });
  it("inseminated, not checked: preg check, heat, health", () => {
    expect(quickActionsFor(cow({ reproductiveStatus: "BRED_AWAITING_CONFIRMATION" }), allow)).toEqual(["PREG_CHECK", "HEAT", "ILLNESS"]);
  });
  it("pregnant: preg check, dry off, vaccination", () => {
    expect(quickActionsFor(cow({ reproductiveStatus: "PREGNANT" }), allow)).toEqual(["PREG_CHECK", "DRY_OFF", "VACCINATION"]);
  });
  it("dry and pregnant (close-up): calving first", () => {
    expect(quickActionsFor(cow({ reproductiveStatus: "PREGNANT", productionStatus: "DRY" }), allow)[0]).toBe("CALVING");
  });
  it("sick animal: treatment first, ahead of the reproduction row", () => {
    expect(quickActionsFor(cow({ healthStatus: "SICK" }), allow)[0]).toBe("TREATMENT");
  });
  it("calf: weight, vaccination, weaning", () => {
    expect(quickActionsFor({ gender: "FEMALE", animalCategory: "CALF", herdStatus: "ACTIVE" }, allow)).toEqual(["WEIGHT", "VACCINATION", "WEAN"]);
  });
  it("left herd or deleted: none", () => {
    expect(quickActionsFor(cow({ herdStatus: "SOLD" }), allow)).toEqual([]);
    expect(quickActionsFor(cow({ deletedAt: "2026-10-01" }), allow)).toEqual([]);
  });
  it("drops events the role cannot record", () => {
    expect(quickActionsFor(cow(), (permission) => permission !== "reproduction.heat")).not.toContain("HEAT");
    expect(quickActionsFor(cow(), () => false)).toEqual([]);
  });
  it("never more than three", () => {
    expect(quickActionsFor(cow(), allow).length).toBeLessThanOrEqual(3);
  });
});
