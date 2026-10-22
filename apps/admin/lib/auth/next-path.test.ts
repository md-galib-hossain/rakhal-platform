import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

describe("safeNextPath", () => {
  it("keeps same-site paths with query strings", () => {
    expect(safeNextPath("/farms?q=a")).toBe("/farms?q=a");
    expect(safeNextPath("/audit")).toBe("/audit");
  });

  it.each([
    ["//evil.example"],
    ["https://evil.example"],
    ["/\\evil.example"],
    ["javascript:alert(1)"],
    ["farms"],
    [""],
    ["/login"],
    ["/login/setup-2fa"],
    ["/api/auth/logout"],
  ])("falls back to / for %s", (value) => {
    expect(safeNextPath(value)).toBe("/");
  });

  it("handles missing values and arrays", () => {
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(["/farms", "/users"])).toBe("/farms");
  });
});
