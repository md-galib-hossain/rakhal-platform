import { describe, expect, it } from "vitest";
import { applicableCards } from "./applicability";

const cattle = (gender: "FEMALE" | "MALE" | "CASTRATED_MALE", animalCategory: "CALF" | "HEIFER" | "COW" | "BULL" | "STEER", productionStatus: "MILKING" | "DRY" | null = null) => ({
  gender,
  animalCategory,
  productionStatus,
});

describe("applicableCards", () => {
  it("cow gets all four cards", () => {
    expect(applicableCards(cattle("FEMALE", "COW", "MILKING"))).toEqual(["reproduction", "milk", "health", "growth"]);
  });
  it("heifer gets reproduction but no milk card", () => {
    expect(applicableCards(cattle("FEMALE", "HEIFER"))).toEqual(["reproduction", "health", "growth"]);
  });
  it("steer has no reproduction card", () => {
    expect(applicableCards(cattle("CASTRATED_MALE", "STEER"))).toEqual(["health", "growth"]);
  });
  it("bull and calf have no reproduction or milk card", () => {
    expect(applicableCards(cattle("MALE", "BULL"))).toEqual(["health", "growth"]);
    expect(applicableCards(cattle("FEMALE", "CALF"))).toEqual(["health", "growth"]);
  });
});
