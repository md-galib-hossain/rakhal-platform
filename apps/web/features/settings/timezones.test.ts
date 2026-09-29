import { describe, expect, it } from "vitest";
import { COMMON_TIMEZONES, timezoneLabel, timezoneOptions } from "./timezones";

describe("timezones", () => {
  it("leads with Bangladesh, the default", () => {
    expect(COMMON_TIMEZONES[0]).toBe("Asia/Dhaka");
  });

  it("labels a zone with its UTC offset", () => {
    expect(timezoneLabel("Asia/Dhaka")).toBe("Asia/Dhaka (UTC+06:00)");
    expect(timezoneLabel("Asia/Kolkata")).toBe("Asia/Kolkata (UTC+05:30)");
    expect(timezoneLabel("America/New_York")).toMatch(/^America\/New York \(UTC-0[45]:00\)$/);
  });

  it("falls back to the bare name for a zone Intl does not know", () => {
    expect(timezoneLabel("Not/AZone")).toBe("Not/AZone");
  });

  it("always includes the farm's current zone, even when it is not in the common list", () => {
    const values = timezoneOptions("Pacific/Auckland").map((o) => o.value);
    expect(values[0]).toBe("Pacific/Auckland");
    expect(values).toContain("Asia/Dhaka");
    // No duplicate when the current zone is already listed.
    expect(timezoneOptions("Asia/Dhaka").filter((o) => o.value === "Asia/Dhaka")).toHaveLength(1);
  });
});
