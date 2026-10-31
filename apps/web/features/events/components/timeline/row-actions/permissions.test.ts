import { describe, expect, it } from "vitest";
import { AUTHOR_WINDOW_MS, canChangeEvent, formKeyForType } from "./permissions";

const NOW = Date.parse("2026-10-30T12:00:00Z");
const row = (over: Partial<Parameters<typeof canChangeEvent>[0]> = {}) => ({
  status: "ACTIVE" as const,
  recordedById: "u1",
  createdAt: new Date(NOW - 60 * 60 * 1000).toISOString(),
  ...over,
});
const worker = { id: "u1", canRecord: true, canVoid: false };

describe("canChangeEvent", () => {
  it("lets the author change it within 24 h", () => {
    expect(canChangeEvent(row(), worker, NOW)).toBe(true);
  });
  it("closes the window after 24 h for the author", () => {
    const old = row({ createdAt: new Date(NOW - AUTHOR_WINDOW_MS - 1000).toISOString() });
    expect(canChangeEvent(old, worker, NOW)).toBe(false);
  });
  it("never lets another user change it without the manager permission", () => {
    expect(canChangeEvent(row({ recordedById: "u2" }), worker, NOW)).toBe(false);
  });
  it("lets a manager change any event at any time", () => {
    const old = row({ recordedById: "u2", createdAt: "2026-01-01T00:00:00Z" });
    expect(canChangeEvent(old, { id: "m", canRecord: true, canVoid: true }, NOW)).toBe(true);
  });
  it("offers nothing for a voided row or without cattle.event", () => {
    expect(canChangeEvent(row({ status: "VOIDED" }), { ...worker, canVoid: true }, NOW)).toBe(false);
    expect(canChangeEvent(row(), { ...worker, canRecord: false }, NOW)).toBe(false);
  });
  it("offers nothing on a row with no server author", () => {
    expect(canChangeEvent(row({ recordedById: undefined }), worker, NOW)).toBe(false);
  });
});

describe("formKeyForType", () => {
  it("maps a stored type back to its record form", () => {
    expect(formKeyForType("WEIGHT")).toBe("WEIGHT");
    expect(formKeyForType("BREEDING")).toBe("SERVICE");
  });
});
