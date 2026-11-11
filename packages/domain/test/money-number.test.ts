import { test } from "node:test";
import assert from "node:assert/strict";
import { applyDigits, formatMoney, formatNumber, groupIndian, roundHalfExpand, roundHalfExpandParts } from "../src/index.ts";

test("formatMoney spec headline: 1250000 -> lakh grouping", () => {
  assert.equal(formatMoney(1250000), "৳12,50,000");
});

test("formatMoney throws RangeError for NaN, Infinity and unsafe magnitudes", () => {
  for (const bad of [Number.NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 2, -(Number.MAX_SAFE_INTEGER + 2)]) {
    assert.throws(() => formatMoney(bad), RangeError, String(bad));
    assert.throws(() => formatNumber(bad), RangeError, String(bad));
  }
  assert.throws(() => formatMoney("5" as unknown as number), RangeError);
});

test("negative zero and values rounding to zero never print a sign", () => {
  assert.equal(formatMoney(-0), "৳0");
  assert.equal(formatMoney(-0.4), "৳0");
  assert.equal(formatNumber(-0.0004, { fractionDigits: 2 }), "0");
  assert.equal(formatMoney(-0.004, { fractionDigits: 2 }), "৳0.00");
  assert.equal(formatNumber(-0.5), "-1");
});

test("fraction options are validated", () => {
  assert.throws(() => formatNumber(1, { fractionDigits: -1 }), RangeError);
  assert.throws(() => formatNumber(1, { fractionDigits: 21 }), RangeError);
  assert.throws(() => formatNumber(1, { fractionDigits: 1.5 }), RangeError);
  assert.throws(() => formatNumber(1, { fractionDigits: 1, minFractionDigits: 2 }), RangeError);
});

test("minFractionDigits must be an integer 0..fractionDigits", () => {
  for (const min of [-1, 1.5, Number.NaN, Infinity, 4]) {
    assert.throws(() => formatNumber(1, { fractionDigits: 3, minFractionDigits: min }), RangeError, String(min));
  }
  assert.equal(formatNumber(1, { fractionDigits: 3, minFractionDigits: 3 }), "1.000");
  assert.equal(formatNumber(1, { fractionDigits: 3, minFractionDigits: 0 }), "1");
  assert.throws(() => formatMoney(1, { fractionDigits: 1.5 }), RangeError);
  assert.throws(() => formatMoney(1, { fractionDigits: -1 }), RangeError);
});

test("digits option is validated (RangeError on an unknown digit system)", () => {
  const bad = "arab" as unknown as "latn";
  assert.throws(() => formatNumber(1, { digits: bad }), RangeError);
  assert.throws(() => formatMoney(1, { digits: bad }), RangeError);
  assert.throws(() => applyDigits("1", bad), RangeError);
  assert.throws(() => applyDigits("1", undefined as unknown as "latn"), RangeError);
});

test("rounding works on the shortest decimal, not binary value", () => {
  assert.equal(formatNumber(1.005, { fractionDigits: 2 }), "1.01"); // binary 1.005 is 1.00499999...
  assert.equal(formatNumber(8.345, { fractionDigits: 2 }), "8.35");
  assert.equal(formatNumber(0.15, { fractionDigits: 1 }), "0.2");
});

test("exponent-form inputs are expanded", () => {
  assert.equal(formatNumber(1e-7, { fractionDigits: 7, minFractionDigits: 7 }), "0.0000001");
  assert.equal(formatNumber(1.5e-7, { fractionDigits: 7 }), "0.0000002");
  assert.equal(formatNumber(1e12), "10,00,00,00,00,000");
});

test("groupIndian", () => {
  const cases: [string, string][] = [
    ["0", "0"], ["12", "12"], ["123", "123"], ["1234", "1,234"], ["12345", "12,345"], ["123456", "1,23,456"],
    ["1234567", "12,34,567"], ["12345678", "1,23,45,678"], ["100000000000", "1,00,00,00,00,000"], ["0001234", "1,234"],
  ];
  for (const [i, o] of cases) assert.equal(groupIndian(i), o);
});

test("roundHalfExpand carries and pads", () => {
  assert.equal(roundHalfExpand("9.995", 2), "10.00");
  assert.equal(roundHalfExpand("99.5", 0), "100");
  assert.equal(roundHalfExpand("0.4", 0), "0");
  assert.equal(roundHalfExpand("1.2", 3), "1.200");
  assert.deepEqual(roundHalfExpandParts("0.999", 1), { int: "1", frac: "0" });
  assert.throws(() => roundHalfExpand("-1", 0), RangeError);
  assert.throws(() => roundHalfExpand("1e5", 0), RangeError);
});

test("Bangla digits option on numbers", () => {
  assert.equal(formatNumber(1234567.5, { fractionDigits: 1, digits: "beng" }), "১২,৩৪,৫৬৭.৫");
  assert.equal(formatNumber(-5, { digits: "beng" }), "-৫");
});
