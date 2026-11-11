import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DHAKA_OFFSET_MINUTES, MONTHS_LONG, MONTHS_SHORT, WEEKDAYS_LONG, WEEKDAYS_SHORT,
  dhakaParts, farmDayKey, formatDate, formatDateTime, formatTime,
} from "../src/index.ts";
import type { DateFormatOptions, DigitSystem } from "../src/index.ts";

test("Dhaka offset is fixed +06:00", () => {
  assert.equal(DHAKA_OFFSET_MINUTES, 360);
});

test("dhakaParts crosses midnight forward", () => {
  const p = dhakaParts(Date.UTC(2026, 10, 11, 18, 30));
  assert.deepEqual(p, { year: 2026, month: 11, day: 12, weekday: 4, hour: 0, minute: 30 }); // Thursday
});

test("dhakaParts accepts a Date instance (timezone independence is proven by test/timezone.test.ts)", () => {
  const d = new Date("2026-11-11T17:59:59.999Z");
  assert.equal(dhakaParts(d).day, 11);
  assert.equal(dhakaParts(d).hour, 23);
});

test("year, leap day and month boundaries", () => {
  assert.equal(farmDayKey(Date.UTC(2028, 1, 28, 18, 0)), "2028-02-29");
  assert.equal(farmDayKey(Date.UTC(2027, 1, 28, 18, 0)), "2027-03-01");
  assert.equal(farmDayKey(Date.UTC(2026, 11, 31, 17, 59)), "2026-12-31");
  assert.equal(farmDayKey(Date.UTC(2026, 11, 31, 18, 0)), "2027-01-01");
});

test("invalid dates throw RangeError", () => {
  assert.throws(() => formatDate(new Date("nope"), { locale: "en" }), RangeError);
  assert.throws(() => farmDayKey(Number.NaN), RangeError);
  assert.throws(() => formatTime(Infinity), RangeError);
});

test("formatDate / formatDateTime reject an unknown digit system", () => {
  const bad = { locale: "en", digits: "arab" } as unknown as DateFormatOptions;
  assert.throws(() => formatDate(0, bad), RangeError);
  assert.throws(() => formatDateTime(0, bad), RangeError);
  assert.throws(() => formatTime(0, "arab" as unknown as DigitSystem), RangeError);
});

test("farmDayKey throws RangeError for Dhaka years outside 0..9999", () => {
  assert.equal(farmDayKey(Date.UTC(9999, 11, 31, 17, 59)), "9999-12-31");
  assert.throws(() => farmDayKey(Date.UTC(9999, 11, 31, 18, 0)), RangeError); // Dhaka: year 10000
  assert.throws(() => farmDayKey(Date.UTC(275000, 0, 1)), RangeError);
  assert.throws(() => farmDayKey(Date.UTC(-1, 5, 1)), RangeError); // year -1
  const y0 = new Date(Date.UTC(2000, 0, 1)); y0.setUTCFullYear(0, 0, 1);
  assert.equal(farmDayKey(y0), "0000-01-01");
});

test("name tables are complete", () => {
  for (const loc of ["bn", "en"] as const) {
    assert.equal(MONTHS_LONG[loc].length, 12);
    assert.equal(MONTHS_SHORT[loc].length, 12);
    assert.equal(WEEKDAYS_LONG[loc].length, 7);
    assert.equal(WEEKDAYS_SHORT[loc].length, 7);
  }
});

test("formatDate styles, locales and digits", () => {
  const t = Date.UTC(2026, 10, 11, 5, 0);
  assert.equal(formatDate(t, { locale: "en" }), "11 Nov, 2026");
  assert.equal(formatDate(t, { locale: "en", style: "long" }), "11 November, 2026");
  assert.equal(formatDate(t, { locale: "bn", style: "short", digits: "beng" }), "১১ নভেম্বর, ২০২৬");
  assert.equal(formatDate(t, { locale: "bn", style: "long" }), "11 নভেম্বর, 2026");
  assert.equal(formatDate(t, { locale: "bn", style: "short" }), formatDate(t, { locale: "bn" })); // short is the default
});

test("formatDateTime uses 24-hour time", () => {
  assert.equal(formatDateTime(Date.UTC(2026, 10, 11, 9, 5), { locale: "en" }), "11 Nov, 2026, 15:05");
  assert.equal(formatDateTime(Date.UTC(2026, 10, 11, 9, 5), { locale: "bn", digits: "beng" }), "১১ নভেম্বর, ২০২৬, ১৫:০৫");
});

test("farmDayKey keeps Latin digits and zero padding", () => {
  assert.equal(farmDayKey(Date.UTC(2026, 0, 5, 6, 0)), "2026-01-05");
});
