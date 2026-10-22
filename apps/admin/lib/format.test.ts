import { describe, expect, it } from "vitest";
import { formatCount, formatDate, formatDateTime, formatLocation, humanizeEnum } from "./format";

describe("format", () => {
  it("renders dates in Bangladesh time", () => {
    // 20:00 UTC is 02:00 the next day in Dhaka (UTC+6).
    expect(formatDateTime("2026-10-22T20:00:00.000Z")).toContain("23 Oct 2026");
    expect(formatDate("2026-10-22T20:00:00.000Z")).toContain("23 Oct 2026");
  });

  it("shows a dash for missing or invalid values", () => {
    expect(formatDateTime(null)).toBe("-");
    expect(formatDateTime(undefined)).toBe("-");
    expect(formatDateTime("not a date")).toBe("-");
    expect(formatDate("")).toBe("-");
  });

  it("groups thousands", () => expect(formatCount(1234567)).toBe("1,234,567"));

  it("joins only the location parts that exist", () => {
    expect(formatLocation("Dhaka", null, "Savar")).toBe("Dhaka, Savar");
    expect(formatLocation(null, undefined, " ")).toBe("-");
  });

  it("humanizes enum values", () => expect(humanizeEnum("SUPPORT_ADMIN")).toBe("support admin"));
});
