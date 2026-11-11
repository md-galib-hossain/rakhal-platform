import { test } from "node:test";
import assert from "node:assert/strict";
import { evaluateGolden, goldenVectors, runGoldenVectors } from "../src/index.ts";

test("golden vector table has the spec minimum", () => {
  assert.ok(goldenVectors.length >= 60);
});

for (const v of goldenVectors) {
  test(`golden: ${v.fn}(${JSON.stringify(v.args)}) -> ${v.expected}`, () => {
    assert.equal(evaluateGolden(v), v.expected);
  });
}

test("runGoldenVectors reports all passing on this engine", () => {
  const r = runGoldenVectors();
  assert.equal(r.failures.length, 0, JSON.stringify(r.failures));
  assert.equal(r.passed, r.total);
});

test("runGoldenVectors counts failures and thrown calls instead of throwing", () => {
  const r = runGoldenVectors([
    { fn: "formatMoney", args: [1], expected: "wrong" },
    { fn: "formatMoney", args: [Number.NaN], expected: "x" },
    { fn: "formatMoney", args: [1], expected: "৳1" },
  ]);
  assert.equal(r.total, 3);
  assert.equal(r.passed, 1);
  assert.equal(r.failures.length, 2);
  assert.match(r.failures[1]?.actual ?? "", /^threw: /);
});
