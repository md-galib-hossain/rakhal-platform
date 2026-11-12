import { describe, expect, it } from "vitest";
import bn from "@/i18n/messages/bn.json";
import en from "@/i18n/messages/en.json";
import { PERIOD_ERROR_CODES, REPORT_API_REASONS, REPORT_ERROR_CATEGORIES } from "../types";
import { REPORT_VALIDATION_KEYS } from "../schemas";
import { REPORT_REASON_KEYS, REPORT_PERIOD_CODE_KEYS } from "./errors";
import { METRIC_STATE_KEYS, unitLabelKey } from "./format";
import {
  datePresetKey,
  metricDefinitionKey,
  metricLabelKey,
  reportDomainKey,
  reportOriginKey,
  reportScopeKindKey,
  reportStatusKey,
  reportTypeKey,
  sourceLabelKey,
} from "./labels";
import {
  ALL_LABELLED_METRIC_IDS,
  REPORT_DQ_NOTE_KEYS,
  REPORT_EXCEPTION_MESSAGE_KEYS,
  REPORT_MILK_REASON_KEYS,
  REPORT_SECTION_TITLE_KEYS,
  REPORT_SOURCES,
  REPORT_UNITS,
} from "./metric-ids";
import { DATE_PRESETS, REPORT_DOMAINS, REPORT_ORIGINS, REPORT_SCOPE_KINDS, REPORT_STATUSES, REPORT_TYPES } from "../types";

type Tree = { [k: string]: string | Tree };
const messages = { en: en as unknown as Tree, bn: bn as unknown as Tree };

function flatten(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out.set(key, v);
    else for (const [ck, cv] of flatten(v, key)) out.set(ck, cv);
  }
  return out;
}

const flat = {
  en: flatten(messages.en.reports as Tree, "reports"),
  bn: flatten(messages.bn.reports as Tree, "reports"),
};

describe("reports i18n namespace", () => {
  it("has identical key sets in bn and en", () => {
    const onlyEn = [...flat.en.keys()].filter((k) => !flat.bn.has(k));
    const onlyBn = [...flat.bn.keys()].filter((k) => !flat.en.has(k));
    expect(onlyEn).toEqual([]);
    expect(onlyBn).toEqual([]);
  });
  it("has no empty strings and keeps ICU placeholders aligned", () => {
    for (const locale of ["en", "bn"] as const) {
      for (const [k, v] of flat[locale]) {
        expect(v.trim(), `${locale}:${k}`).not.toBe("");
      }
    }
    for (const [k, v] of flat.en) {
      const ph = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(ph(flat.bn.get(k) ?? ""), k).toEqual(ph(v));
    }
  });
  it("Bangla values contain Bangla script (not copied English)", () => {
    const allowedLatin = new Set(["reports.units.L", "reports.units.kg"]);
    for (const [k, v] of flat.bn) {
      if (allowedLatin.has(k)) continue;
      expect(/[ঀ-৿]/.test(v), `${k}: ${v}`).toBe(true);
    }
  });

  const requireKeys = (keys: readonly (string | null)[]) => {
    for (const locale of ["en", "bn"] as const) {
      for (const key of keys) {
        expect(key).not.toBeNull();
        expect(flat[locale].has(key as string), `${locale} missing ${key}`).toBe(true);
      }
    }
  };

  it("labels and defines EVERY metric id", () => {
    expect(ALL_LABELLED_METRIC_IDS.length).toBeGreaterThan(60);
    requireKeys(ALL_LABELLED_METRIC_IDS.map((id) => metricLabelKey(id)));
    requireKeys(ALL_LABELLED_METRIC_IDS.map((id) => metricDefinitionKey(id)));
  });
  it("covers every backend reason, period code, error category and validation key", () => {
    requireKeys(Object.values(REPORT_REASON_KEYS));
    requireKeys(Object.values(REPORT_PERIOD_CODE_KEYS));
    requireKeys(Object.values(REPORT_VALIDATION_KEYS));
    requireKeys(REPORT_API_REASONS.map((r) => REPORT_REASON_KEYS[r]));
    requireKeys(PERIOD_ERROR_CODES.map((c) => REPORT_PERIOD_CODE_KEYS[c]));
    requireKeys(REPORT_ERROR_CATEGORIES.map((c) => `reports.errorCategory.${c}`));
    requireKeys(["reports.errors.generic", "reports.errors.forbidden", "reports.errors.notFound", "reports.errors.rateLimited", "reports.errors.network"]);
  });
  it("covers enums: status, type, origin, scope kind, preset, domain", () => {
    requireKeys(REPORT_STATUSES.map(reportStatusKey));
    requireKeys(REPORT_TYPES.map(reportTypeKey));
    requireKeys(REPORT_ORIGINS.map(reportOriginKey));
    requireKeys(REPORT_SCOPE_KINDS.map(reportScopeKindKey));
    requireKeys(DATE_PRESETS.map(datePresetKey));
    requireKeys(REPORT_DOMAINS.map(reportDomainKey));
  });
  it("covers metric states, units, sources, dq notes, exceptions, sections and milk reasons", () => {
    requireKeys(Object.values(METRIC_STATE_KEYS));
    requireKeys(REPORT_UNITS.map((u) => unitLabelKey(u)).filter((k): k is string => k !== null));
    requireKeys(REPORT_SOURCES.map((s) => sourceLabelKey(s)));
    requireKeys(REPORT_DQ_NOTE_KEYS);
    requireKeys(REPORT_EXCEPTION_MESSAGE_KEYS);
    requireKeys(REPORT_SECTION_TITLE_KEYS);
    requireKeys(REPORT_MILK_REASON_KEYS);
  });
  it("never calls offered-minus-refusal 'consumed' or 'intake' without 'not measured'", () => {
    for (const locale of ["en"] as const) {
      const text = flat[locale].get("reports.sources.offeredMinusRefusal") ?? "";
      expect(text.toLowerCase()).not.toContain("consumed");
      expect(text.toLowerCase()).toContain("not measured");
    }
    expect(flat.en.get("reports.metrics.feed.offered_minus_refusal_kg.definition")).toMatch(/not measured intake/i);
  });
  it("includes the common actions", () => {
    requireKeys(["download", "retry", "delete", "preview", "generate"].map((a) => `reports.actions.${a}`));
  });
});
