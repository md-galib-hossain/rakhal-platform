import { describe, expect, it } from "vitest";
import type { HealthCaseListItem } from "../../types";
import { caseDay, findBlockingCase } from "./open-case-guard";

const row = (id: string, condition: HealthCaseListItem["condition"]) => ({ id, condition }) as HealthCaseListItem;

describe("caseDay", () => {
  it("counts the start day as day 1", () => {
    expect(caseDay("2026-10-01T03:00:00", new Date("2026-10-01T18:00:00"))).toBe(1);
  });

  it("counts whole calendar days, not 24h blocks", () => {
    // reported late evening, checked next morning → day 2
    expect(caseDay("2026-10-01T23:30:00", new Date("2026-10-02T06:00:00"))).toBe(2);
    expect(caseDay("2026-09-24T10:00:00", new Date("2026-10-01T10:00:00"))).toBe(8);
  });

  it("never goes below day 1 (clock skew / future start)", () => {
    expect(caseDay("2026-10-05T00:00:00", new Date("2026-10-01T00:00:00"))).toBe(1);
  });
});

describe("findBlockingCase", () => {
  const cases = [row("c1", "MASTITIS"), row("c2", null), row("c3", "LAMENESS")];

  it("blocks only when an open case has the same condition (the backend 409 rule)", () => {
    expect(findBlockingCase(cases, "MASTITIS")?.id).toBe("c1");
    expect(findBlockingCase(cases, "KETOSIS")).toBeUndefined();
  });

  it("does not block before a condition is chosen", () => {
    expect(findBlockingCase(cases, undefined)).toBeUndefined();
  });

  it("does not treat a condition-less open case as a match", () => {
    expect(findBlockingCase([row("c2", null)], "OTHER")).toBeUndefined();
  });
});
