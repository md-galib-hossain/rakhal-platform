import { describe, expect, it } from "vitest";
import { formatDate, formatMoney, formatNumber } from "./format";

describe("formatMoney", () => {
  it("groups as lakhs with Latin digits and a ৳ prefix in bn", () => {
    expect(formatMoney(1250000, "bn")).toBe("৳12,50,000");
  });
  it("groups as lakhs with a ৳ prefix in en", () => {
    expect(formatMoney(119000, "en")).toBe("৳1,19,000");
  });
  it("has no decimals", () => {
    expect(formatMoney(12000.5, "en")).toBe("৳12,001");
  });
});

describe("formatNumber", () => {
  it("uses Latin digits in bn", () => {
    expect(formatNumber(84.5, "bn")).toBe("84.5");
  });
});

describe("formatDate", () => {
  it("renders Bengali month names with Latin digits in bn", () => {
    expect(formatDate("2026-07-09T00:00:00Z", "bn")).toContain("জুল");
    expect(formatDate("2026-07-09T00:00:00Z", "bn")).not.toMatch(/[০-৯]/);
  });
});
