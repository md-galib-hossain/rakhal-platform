/**
 * Differential test: our engine-independent formatter vs Node's ICU Intl (en-IN / bn-BD) as a TEST-ONLY oracle.
 * Intl is never used by src/. Fraction digits 0..6, integers up to 16 digits, minFractionDigits. Documented divergence excluded: ICU prints "-0" where we print "0".
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { formatMoney, formatNumber } from "../src/index.ts";

// Deterministic PRNG (mulberry32) so failures reproduce.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function sampleValues(): number[] {
  const rnd = mulberry32(20261111);
  const out: number[] = [
    0, 1, 7, 9, 10, 99, 100, 999, 1000, 9999, 10000, 99999, 100000, 999999, 1000000, 9999999, 10000000, 99999999,
    100000000, 1250000, 12345678, 123456789, 1000000000, 9007199254740991,
    0.5, 1.5, 2.5, 0.05, 0.005, 0.0005, 1.005, 8.345, 12.35, 99999.5, 1234.49, 1234.5, 999.995, 0.1 + 0.2,
    1e-7, 1.5e-7, 5e-7, 123456.789e-2,
  ];
  for (let i = 0; i < 2000; i++) {
    const intDigits = 1 + Math.floor(rnd() * 16); // up to 16 digits; clamped below to MAX_SAFE_INTEGER
    let intStr = "";
    for (let d = 0; d < intDigits; d++) intStr += Math.floor(rnd() * 10);
    const fracLen = Math.floor(rnd() * 8);
    let fracStr = "";
    for (let d = 0; d < fracLen; d++) fracStr += Math.floor(rnd() * 10);
    const n = Number(fracStr === "" ? intStr : `${intStr}.${fracStr}`);
    out.push(Math.min(n, Number.MAX_SAFE_INTEGER));
  }
  // Integers around the 16-digit boundary.
  for (let k = 0; k < 20; k++) out.push(Number.MAX_SAFE_INTEGER - k, 1e15 + k, 1e15 - k);
  return out;
}

const values = sampleValues();
const signed = [...values, ...values.map((v) => -v)];

function intl(locale: string, max: number, min: number) {
  return new Intl.NumberFormat(locale, { maximumFractionDigits: max, minimumFractionDigits: min, useGrouping: true });
}

const looksNegativeZero = (s: string) => /^-0(\.0*)?$/.test(s);

test("oracle sanity: Node has full ICU for en-IN and bn-BD", () => {
  assert.equal(new Intl.NumberFormat("en-IN").format(1250000), "12,50,000");
  assert.equal(new Intl.NumberFormat("bn-BD-u-nu-latn").format(1250000), "12,50,000");
  assert.equal(new Intl.NumberFormat("bn-BD").format(1250000), "১২,৫০,০০০");
});

const FRACTION_RANGE = [0, 1, 2, 3, 4, 5, 6];

for (const fractionDigits of FRACTION_RANGE) {
  test(`formatNumber == Intl en-IN, max ${fractionDigits} fraction digits (${signed.length} values)`, () => {
    const f = intl("en-IN", fractionDigits, 0);
    for (const v of signed) {
      const expected = f.format(v);
      if (looksNegativeZero(expected)) continue; // documented divergence
      assert.equal(formatNumber(v, { fractionDigits }), expected, `value ${v}`);
    }
  });

  test(`formatNumber minFractionDigits 1..${fractionDigits} == Intl en-IN (zero padded)`, () => {
    for (let min = 1; min <= fractionDigits; min++) {
      const f = intl("en-IN", fractionDigits, min);
      for (const v of signed) {
        const expected = f.format(v);
        if (looksNegativeZero(expected)) continue;
        assert.equal(formatNumber(v, { fractionDigits, minFractionDigits: min }), expected, `value ${v} min ${min}`);
      }
    }
  });

  test(`formatMoney == taka sign + Intl en-IN, fixed ${fractionDigits} fraction digits`, () => {
    const f = intl("en-IN", fractionDigits, fractionDigits);
    for (const v of signed) {
      const body = f.format(v);
      if (looksNegativeZero(body)) continue;
      assert.equal(formatMoney(v, { fractionDigits }), "৳" + body, `value ${v}`);
    }
  });

  test(`Latin digits == Intl bn-BD-u-nu-latn, max ${fractionDigits}`, () => {
    const f = intl("bn-BD-u-nu-latn", fractionDigits, 0);
    for (const v of signed) {
      const expected = f.format(v);
      if (looksNegativeZero(expected)) continue;
      assert.equal(formatNumber(v, { fractionDigits }), expected, `value ${v}`);
    }
  });

  test(`Bangla digits == Intl bn-BD (default numbering), max ${fractionDigits}`, () => {
    const f = intl("bn-BD", fractionDigits, 0);
    const latn = intl("bn-BD-u-nu-latn", fractionDigits, 0);
    for (const v of signed) {
      if (looksNegativeZero(latn.format(v))) continue; // documented divergence, decided on the Latin rendering
      // ICU's bn minus is U+002D here; normalise defensively in case a build emits U+2212.
      assert.equal(formatNumber(v, { fractionDigits, digits: "beng" }), f.format(v).replace("−", "-"), `value ${v}`);
    }
  });
}

test("documented divergence: ICU prints -0, we print 0", () => {
  assert.equal(new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(-0.4), "-0");
  assert.equal(formatNumber(-0.4), "0");
});
