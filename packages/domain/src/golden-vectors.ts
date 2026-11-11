import { toBanglaDigits } from "./digits.ts";
import { farmDayKey, formatDate, formatDateTime, formatTime } from "./date.ts";
import { parseLocale, scriptOfText } from "./locale.ts";
import { formatMoney } from "./money.ts";
import { formatNumber, groupIndian, roundHalfExpand } from "./number.ts";

/**
 * Golden vectors: the closed spec of the formatters, as data. Used by the Node tests and by the in-app
 * "Formatter self-test" so the same table can be run on the device's JS engine (Hermes).
 * Add vectors, never remove them. Args are JSON-serialisable.
 */
type Vec<F extends (...args: never[]) => unknown, N extends string> = {
  fn: N;
  args: Parameters<F>;
  expected: string;
};

export type GoldenVector =
  | Vec<typeof formatMoney, "formatMoney">
  | Vec<typeof formatNumber, "formatNumber">
  | Vec<typeof groupIndian, "groupIndian">
  | Vec<typeof roundHalfExpand, "roundHalfExpand">
  | Vec<typeof toBanglaDigits, "toBanglaDigits">
  | Vec<typeof scriptOfText, "scriptOfText">
  | { fn: "parseLocale"; args: [raw: unknown]; expected: string }
  | Vec<typeof formatDate, "formatDate">
  | Vec<typeof formatTime, "formatTime">
  | Vec<typeof formatDateTime, "formatDateTime">
  | Vec<typeof farmDayKey, "farmDayKey">;

export type GoldenFn = GoldenVector["fn"];

const T = "৳"; // taka sign

// 2026-11-11T18:30:00Z = 2026-11-12 00:30 in Dhaka (crosses local midnight).
const MIDNIGHT_CROSS = Date.UTC(2026, 10, 11, 18, 30);
// 2026-11-11T17:59:59.999Z = 2026-11-11 23:59 in Dhaka.
const BEFORE_MIDNIGHT = Date.UTC(2026, 10, 11, 17, 59, 59, 999);

export const goldenVectors: readonly GoldenVector[] = [
  // formatMoney: lakh/crore grouping
  { fn: "formatMoney", args: [0], expected: `${T}0` },
  { fn: "formatMoney", args: [7], expected: `${T}7` },
  { fn: "formatMoney", args: [999], expected: `${T}999` },
  { fn: "formatMoney", args: [1000], expected: `${T}1,000` },
  { fn: "formatMoney", args: [12345], expected: `${T}12,345` },
  { fn: "formatMoney", args: [99999], expected: `${T}99,999` },
  { fn: "formatMoney", args: [100000], expected: `${T}1,00,000` },
  { fn: "formatMoney", args: [1250000], expected: `${T}12,50,000` },
  { fn: "formatMoney", args: [12345678], expected: `${T}1,23,45,678` },
  { fn: "formatMoney", args: [123456789], expected: `${T}12,34,56,789` },
  { fn: "formatMoney", args: [1000000000], expected: `${T}1,00,00,00,000` },
  { fn: "formatMoney", args: [9007199254740991], expected: `${T}9,00,71,99,25,47,40,991` },
  // rounding (half away from zero on the shortest decimal)
  { fn: "formatMoney", args: [1234.49], expected: `${T}1,234` },
  { fn: "formatMoney", args: [1234.5], expected: `${T}1,235` },
  { fn: "formatMoney", args: [99999.5], expected: `${T}1,00,000` },
  { fn: "formatMoney", args: [0.5], expected: `${T}1` },
  { fn: "formatMoney", args: [2.5], expected: `${T}3` },
  { fn: "formatMoney", args: [-0.5], expected: `${T}-1` },
  { fn: "formatMoney", args: [-2.5], expected: `${T}-3` },
  // negatives: web parity, sign after the symbol (O7)
  { fn: "formatMoney", args: [-1234], expected: `${T}-1,234` },
  { fn: "formatMoney", args: [-1234567], expected: `${T}-12,34,567` },
  { fn: "formatMoney", args: [-0.4], expected: `${T}0` },
  { fn: "formatMoney", args: [-0], expected: `${T}0` },
  // digits + fraction digits
  { fn: "formatMoney", args: [1250000, { digits: "beng" }], expected: `${T}১২,৫০,০০০` },
  { fn: "formatMoney", args: [-1234, { digits: "beng" }], expected: `${T}-১,২৩৪` },
  { fn: "formatMoney", args: [1250000.5, { fractionDigits: 2 }], expected: `${T}12,50,000.50` },
  { fn: "formatMoney", args: [450, { fractionDigits: 2 }], expected: `${T}450.00` },
  { fn: "formatMoney", args: [0.005, { fractionDigits: 2 }], expected: `${T}0.01` },
  { fn: "formatMoney", args: [1e-7, { fractionDigits: 2 }], expected: `${T}0.00` },
  { fn: "formatMoney", args: [1e-7], expected: `${T}0` },
  // formatNumber
  { fn: "formatNumber", args: [0], expected: "0" },
  { fn: "formatNumber", args: [1234567.891, { fractionDigits: 3 }], expected: "12,34,567.891" },
  { fn: "formatNumber", args: [12.35, { fractionDigits: 1 }], expected: "12.4" },
  { fn: "formatNumber", args: [12.5, { fractionDigits: 2 }], expected: "12.5" },
  { fn: "formatNumber", args: [12.5, { fractionDigits: 2, minFractionDigits: 2 }], expected: "12.50" },
  { fn: "formatNumber", args: [-12345.678, { fractionDigits: 1 }], expected: "-12,345.7" },
  { fn: "formatNumber", args: [1234.5, { fractionDigits: 1, digits: "beng" }], expected: "১,২৩৪.৫" },
  { fn: "formatNumber", args: [5e-7, { fractionDigits: 6 }], expected: "0.000001" },
  // building blocks
  { fn: "groupIndian", args: ["1250000"], expected: "12,50,000" },
  { fn: "groupIndian", args: ["123"], expected: "123" },
  { fn: "groupIndian", args: ["1234"], expected: "1,234" },
  { fn: "roundHalfExpand", args: ["999.995", 2], expected: "1000.00" },
  { fn: "roundHalfExpand", args: ["0.05", 1], expected: "0.1" },
  { fn: "roundHalfExpand", args: ["12", 2], expected: "12.00" },
  { fn: "roundHalfExpand", args: ["12.5", 0], expected: "13" },
  { fn: "toBanglaDigits", args: ["Tk 1,234.50"], expected: "Tk ১,২৩৪.৫০" },
  // locale/script
  { fn: "scriptOfText", args: ["Milk ৳450", "latin"], expected: "bengali" },
  { fn: "scriptOfText", args: ["Milk 450", "latin"], expected: "latin" },
  { fn: "scriptOfText", args: ["", "bengali"], expected: "bengali" },
  { fn: "parseLocale", args: ["bn"], expected: "bn" },
  { fn: "parseLocale", args: ["fr"], expected: "undefined" },
  // dates (Asia/Dhaka, UTC+06:00)
  { fn: "formatDate", args: [MIDNIGHT_CROSS, { locale: "en" }], expected: "12 Nov, 2026" },
  { fn: "formatDate", args: [BEFORE_MIDNIGHT, { locale: "en" }], expected: "11 Nov, 2026" },
  { fn: "formatDate", args: [MIDNIGHT_CROSS, { locale: "en", style: "long" }], expected: "12 November, 2026" },
  { fn: "formatDate", args: [MIDNIGHT_CROSS, { locale: "bn", style: "long" }], expected: "12 নভেম্বর, 2026" },
  { fn: "formatDate", args: [MIDNIGHT_CROSS, { locale: "bn", style: "long", digits: "beng" }], expected: "১২ নভেম্বর, ২০২৬" },
  { fn: "formatDate", args: [MIDNIGHT_CROSS, { locale: "bn", style: "short", digits: "beng" }], expected: "১২ নভেম্বর, ২০২৬" },
  { fn: "formatTime", args: [MIDNIGHT_CROSS], expected: "00:30" },
  { fn: "formatTime", args: [BEFORE_MIDNIGHT], expected: "23:59" },
  { fn: "formatTime", args: [MIDNIGHT_CROSS, "beng"], expected: "০০:৩০" },
  { fn: "formatDateTime", args: [MIDNIGHT_CROSS, { locale: "en" }], expected: "12 Nov, 2026, 00:30" },
  { fn: "formatDate", args: [Date.UTC(2026, 8, 15), { locale: "bn" }], expected: "15 সেপ্ট, 2026" },
  { fn: "formatDate", args: [Date.UTC(2026, 9, 15), { locale: "bn" }], expected: "15 অক্টো, 2026" },
  { fn: "formatDate", args: [Date.UTC(2026, 11, 15), { locale: "bn" }], expected: "15 ডিসে, 2026" },
  { fn: "formatDate", args: [Date.UTC(2026, 8, 15), { locale: "en" }], expected: "15 Sep, 2026" },
  { fn: "farmDayKey", args: [MIDNIGHT_CROSS], expected: "2026-11-12" },
  { fn: "farmDayKey", args: [BEFORE_MIDNIGHT], expected: "2026-11-11" },
  { fn: "farmDayKey", args: [Date.UTC(2026, 0, 1, 0, 0)], expected: "2026-01-01" },
  { fn: "farmDayKey", args: [Date.UTC(2025, 11, 31, 18, 0)], expected: "2026-01-01" },
];

/** Calls the named function with the vector args and stringifies the result for comparison. */
export function evaluateGolden(v: GoldenVector): string {
  switch (v.fn) {
    case "formatMoney": return formatMoney(...v.args);
    case "formatNumber": return formatNumber(...v.args);
    case "groupIndian": return groupIndian(...v.args);
    case "roundHalfExpand": return roundHalfExpand(...v.args);
    case "toBanglaDigits": return toBanglaDigits(...v.args);
    case "scriptOfText": return scriptOfText(...v.args);
    case "parseLocale": return String(parseLocale(...v.args));
    case "formatDate": return formatDate(...v.args);
    case "formatTime": return formatTime(...v.args);
    case "formatDateTime": return formatDateTime(...v.args);
    case "farmDayKey": return farmDayKey(...v.args);
  }
}

export interface GoldenResult {
  total: number;
  passed: number;
  failures: { vector: GoldenVector; actual: string }[];
}

/** Runs every vector on the current JS engine. Never throws; a throwing call counts as a failure. */
export function runGoldenVectors(vectors: readonly GoldenVector[] = goldenVectors): GoldenResult {
  const failures: GoldenResult["failures"] = [];
  for (const vector of vectors) {
    let actual: string;
    try {
      actual = evaluateGolden(vector);
    } catch (e) {
      actual = `threw: ${e instanceof Error ? e.message : String(e)}`;
    }
    if (actual !== vector.expected) failures.push({ vector, actual });
  }
  return { total: vectors.length, passed: vectors.length - failures.length, failures };
}
