import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_DIGITS, DEFAULT_LOCALE, applyDigits, isDigitSystem, isLocale, parseDigits, parseLocale,
  scriptForLocale, scriptOfText, toBanglaDigits,
} from "../src/index.ts";

test("toBanglaDigits maps every digit and leaves the rest alone", () => {
  assert.equal(toBanglaDigits("0123456789"), "০১২৩৪৫৬৭৮৯");
  assert.equal(toBanglaDigits("-1,234.5 Tk"), "-১,২৩৪.৫ Tk");
  assert.equal(toBanglaDigits(""), "");
});

test("applyDigits: latn is identity", () => {
  assert.equal(applyDigits("12,50,000", "latn"), "12,50,000");
  assert.equal(applyDigits("12", "beng"), "১২");
});

test("defaults", () => {
  assert.equal(DEFAULT_LOCALE, "bn");
  assert.equal(DEFAULT_DIGITS, "latn");
});

test("locale / digits parsing never throws and rejects garbage", () => {
  for (const g of [undefined, null, 1, {}, [], "EN", "en-US", "", "fr"]) {
    assert.equal(parseLocale(g), undefined);
    assert.equal(isLocale(g), false);
    assert.equal(parseDigits(g), undefined);
    assert.equal(isDigitSystem(g), false);
  }
  assert.equal(parseLocale("bn"), "bn");
  assert.equal(parseLocale("en"), "en");
  assert.equal(parseDigits("beng"), "beng");
  assert.equal(parseDigits("latn"), "latn");
});

test("script detection", () => {
  assert.equal(scriptForLocale("bn"), "bengali");
  assert.equal(scriptForLocale("en"), "latin");
  assert.equal(scriptOfText("Milk ৳450", "latin"), "bengali");
  assert.equal(scriptOfText("Milk 450", "latin"), "latin");
  assert.equal(scriptOfText("দুগ্ধ", "latin"), "bengali");
  assert.equal(scriptOfText("", "bengali"), "bengali");
  assert.equal(scriptOfText("ॿ", "latin"), "latin"); // just outside block (U+097F Devanagari)
  assert.equal(scriptOfText("ঀ", "latin"), "bengali");
  assert.equal(scriptOfText("৿", "latin"), "bengali");
  assert.equal(scriptOfText("਀", "latin"), "latin");
});
