import { describe, expect, it } from "vitest";
import { derivePreviousPeriod, presetToRange, toPeriodKey } from "./presets";

// Fixed "now" in LOCAL time (date-fns' `startOf*`/`endOf*` operate in local
// time by design — the right behavior for a farmer-facing picker). Wednesday,
// 2026-08-26, mid-quarter (Q3), mid-year. Every expectation below is built
// with the same local `Date` constructor so the suite is timezone-agnostic.
const NOW = new Date(2026, 7, 26, 15, 30, 0);

describe("presetToRange", () => {
  it("today: start of day to end of day", () => {
    const { from, to } = presetToRange("today", NOW);
    expect(from).toEqual(new Date(2026, 7, 26, 0, 0, 0, 0));
    expect(to).toEqual(new Date(2026, 7, 26, 23, 59, 59, 999));
  });

  it("this_week: Monday to now (week starts Monday)", () => {
    const { from, to } = presetToRange("this_week", NOW);
    // 2026-08-26 is a Wednesday; the Monday of that week is 2026-08-24.
    expect(from).toEqual(new Date(2026, 7, 24, 0, 0, 0, 0));
    expect(to).toEqual(new Date(2026, 7, 26, 23, 59, 59, 999));
  });

  it("this_month: 1st of month to now — never the full month", () => {
    const { from, to } = presetToRange("this_month", NOW);
    expect(from).toEqual(new Date(2026, 7, 1, 0, 0, 0, 0));
    expect(to).toEqual(new Date(2026, 7, 26, 23, 59, 59, 999));
  });

  it("last_month: the full previous calendar month", () => {
    const { from, to } = presetToRange("last_month", NOW);
    expect(from).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
    expect(to).toEqual(new Date(2026, 6, 31, 23, 59, 59, 999));
  });

  it("this_quarter: start of quarter to now", () => {
    const { from, to } = presetToRange("this_quarter", NOW);
    expect(from).toEqual(new Date(2026, 6, 1, 0, 0, 0, 0));
    expect(to).toEqual(new Date(2026, 7, 26, 23, 59, 59, 999));
  });

  it("this_year: start of year to now", () => {
    const { from, to } = presetToRange("this_year", NOW);
    expect(from).toEqual(new Date(2026, 0, 1, 0, 0, 0, 0));
    expect(to).toEqual(new Date(2026, 7, 26, 23, 59, 59, 999));
  });
});

describe("derivePreviousPeriod", () => {
  it("mirrors the backend rule: same-length slice of the prior window, not the full prior calendar unit", () => {
    // Aug 1-25 (25 days) -> Jul 1-25 (a same-length 25-day slice), NOT the full July.
    const period = {
      from: new Date(2026, 7, 1, 0, 0, 0, 0),
      to: new Date(2026, 7, 25, 23, 59, 59, 999),
    };
    const previous = derivePreviousPeriod(period);
    const durationMs = period.to.getTime() - period.from.getTime();
    expect(previous.to.getTime()).toBe(period.from.getTime() - 1);
    expect(previous.from.getTime()).toBe(period.from.getTime() - durationMs);
    // Half-open boundary: the slice's own span is `durationMs - 1` (the same
    // `to = from - 1ms` convention the original period's own `to` already
    // carries), matching the original's length exactly.
    expect(previous.to.getTime() - previous.from.getTime()).toBe(durationMs - 1);
  });

  it("shifts a custom range back by its own exact duration", () => {
    const period = { from: new Date(2026, 2, 10), to: new Date(2026, 2, 15) };
    const previous = derivePreviousPeriod(period);
    expect(previous.from).toEqual(new Date(2026, 2, 5));
    expect(previous.to).toEqual(new Date(2026, 2, 9, 23, 59, 59, 999));
  });
});

describe("toPeriodKey", () => {
  it("encodes both bounds so differently-sized ranges never collide", () => {
    const a = toPeriodKey({ from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) });
    const b = toPeriodKey({ from: new Date(2026, 0, 1), to: new Date(2026, 1, 28) });
    expect(a).not.toBe(b);
  });

  it("is deterministic for the same range", () => {
    const range = { from: new Date(2026, 0, 1), to: new Date(2026, 0, 31) };
    expect(toPeriodKey(range)).toBe(toPeriodKey({ ...range }));
  });
});
