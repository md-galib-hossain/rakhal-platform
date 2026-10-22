import { describe, expect, it } from "vitest";
import { canDo, judgeGate } from "./permissions";

describe("canDo", () => {
  it("allows when no permission required", () => expect(canDo([], undefined)).toBe(true));
  it("super wildcard", () => expect(canDo(["*"], "farm.read")).toBe(true));
  it("exact match", () => expect(canDo(["farm.read"], "farm.read")).toBe(true));
  it("resource wildcard", () => expect(canDo(["support.*"], "support.notes")).toBe(true));
  it("denies others", () => expect(canDo(["coupon.read"], "farm.read")).toBe(false));
});

describe("judgeGate", () => {
  it("reports forbidden", () =>
    expect(judgeGate(["coupon.read"], "farm.read")).toEqual({
      allowed: false,
      reason: "forbidden",
    }));
});
