import { describe, expect, it } from "vitest";
import { sanitizeOrder } from "./use-section-layout";

const DEFAULTS = ["a", "b", "c", "d"] as const;

describe("sanitizeOrder", () => {
  it("keeps a valid saved order", () => {
    expect(sanitizeOrder(["d", "a", "c", "b"], DEFAULTS)).toEqual(["d", "a", "c", "b"]);
  });

  it("falls back to defaults for non-arrays", () => {
    expect(sanitizeOrder(null, DEFAULTS)).toEqual(["a", "b", "c", "d"]);
    expect(sanitizeOrder("a,b", DEFAULTS)).toEqual(["a", "b", "c", "d"]);
  });

  it("drops unknown ids and duplicates but keeps the user's order", () => {
    expect(sanitizeOrder(["c", "zzz", "c", "a", 7], DEFAULTS)).toEqual(["c", "a", "b", "d"]);
  });

  it("appends sections added after the save", () => {
    expect(sanitizeOrder(["b", "a"], DEFAULTS)).toEqual(["b", "a", "c", "d"]);
  });
});
