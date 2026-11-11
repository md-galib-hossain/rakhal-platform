/**
 * Differential test: our month / weekday name tables vs Node's ICU/CLDR (`Intl.DateTimeFormat`) as a TEST-ONLY oracle.
 * Intl is never used by src/. Every name (long + short, en + bn) is compared; the only intentional divergence is
 * listed in EXPECTED_DIVERGENCES and is itself asserted, so a silent drift in either direction fails.
 *
 * Oracle locales: en -> "en-US" (the convention the web prints, date-fns "MMM"); bn -> "bn" with Latin numbering.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { MONTHS_LONG, MONTHS_SHORT, WEEKDAYS_LONG, WEEKDAYS_SHORT } from "../src/index.ts";
import type { Locale } from "../src/index.ts";

const ORACLE_LOCALE: Record<Locale, string> = { en: "en-US", bn: "bn-BD-u-nu-latn" };

function icuMonths(locale: string, month: "long" | "short"): string[] {
  const f = new Intl.DateTimeFormat(locale, { month, timeZone: "UTC" });
  return Array.from({ length: 12 }, (_, m) => f.format(Date.UTC(2026, m, 15)));
}

function icuWeekdays(locale: string, weekday: "long" | "short"): string[] {
  const f = new Intl.DateTimeFormat(locale, { weekday, timeZone: "UTC" });
  // 2026-11-08 is a Sunday.
  return Array.from({ length: 7 }, (_, d) => f.format(Date.UTC(2026, 10, 8 + d)));
}

/** Intentional divergences from ICU: [table, locale, index] -> { ours, icu, why }. Empty for bn and long names. */
const EXPECTED_DIVERGENCES: { table: string; locale: Locale; index: number; ours: string; icu: string }[] = [];

const GB_MONTHS_SHORT = icuMonths("en-GB", "short");

for (const locale of ["en", "bn"] as const) {
  const oracle = ORACLE_LOCALE[locale];
  const cases: [string, readonly string[], string[]][] = [
    ["MONTHS_LONG", MONTHS_LONG[locale], icuMonths(oracle, "long")],
    ["MONTHS_SHORT", MONTHS_SHORT[locale], icuMonths(oracle, "short")],
    ["WEEKDAYS_LONG", WEEKDAYS_LONG[locale], icuWeekdays(oracle, "long")],
    ["WEEKDAYS_SHORT", WEEKDAYS_SHORT[locale], icuWeekdays(oracle, "short")],
  ];
  for (const [table, ours, icu] of cases) {
    test(`${table}.${locale} equals ICU (${oracle}) name by name`, () => {
      assert.equal(ours.length, icu.length, `${table}.${locale} length`);
      for (let i = 0; i < icu.length; i++) {
        const allowed = EXPECTED_DIVERGENCES.find((d) => d.table === table && d.locale === locale && d.index === i);
        if (allowed) {
          assert.equal(ours[i], allowed.ours);
          assert.equal(icu[i], allowed.icu);
        } else {
          assert.equal(ours[i], icu[i], `${table}.${locale}[${i}]`);
        }
      }
    });
  }
}

test("bn default-numbering locale 'bn' gives the same names as the Latin-numbering oracle", () => {
  assert.deepEqual(icuMonths("bn", "short"), icuMonths("bn-BD-u-nu-latn", "short"));
  assert.deepEqual(icuWeekdays("bn", "short"), icuWeekdays("bn-BD-u-nu-latn", "short"));
});

test("documented decision: English short September is 'Sep' (en-US / web), not en-GB 'Sept'", () => {
  assert.equal(MONTHS_SHORT.en[8], "Sep");
  assert.equal(GB_MONTHS_SHORT[8], "Sept"); // proves the oracle really differs, so the choice is explicit
  for (let i = 0; i < 12; i++) if (i !== 8) assert.equal(MONTHS_SHORT.en[i], GB_MONTHS_SHORT[i], `en-GB short month ${i}`);
});

test("pinned bn short names (CLDR): Sep/Oct/Dec and Thursday are abbreviated", () => {
  assert.equal(MONTHS_SHORT.bn[8], "সেপ্ট");
  assert.equal(MONTHS_SHORT.bn[9], "অক্টো");
  assert.equal(MONTHS_SHORT.bn[11], "ডিসে");
  assert.equal(WEEKDAYS_SHORT.bn[4], "বৃহস্পতি");
});
