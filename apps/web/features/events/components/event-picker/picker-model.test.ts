import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import type { AnimalFacts, EventKey } from "../../types";
import { buildPickerModel, matchesQuery, suggestedFromUpcoming, type PickerText } from "./picker-model";

type Catalogue = Record<string, PickerText>;
const textFor = (locale: "en" | "bn") => (key: EventKey) => ((locale === "en" ? en : bn) as unknown as { events: { catalogue: Catalogue } }).events.catalogue[key];

const cow: AnimalFacts = { herdStatus: "ACTIVE", gender: "FEMALE", animalCategory: "COW", reproductiveStatus: "OPEN", productionStatus: "MILKING", dim: 90 };
const bull: AnimalFacts = { herdStatus: "ACTIVE", gender: "MALE", animalCategory: "BULL" };
const everything = () => true;

function model(over: Partial<Parameters<typeof buildPickerModel>[0]> = {}) {
  return buildPickerModel({ facts: cow, can: everything, textFor: textFor("en"), query: "", showAll: false, suggestedKeys: [], recentKeys: [], ...over });
}
const keys = (m: ReturnType<typeof model>) => m.groups.flatMap((g) => g.entries.map((e) => e.def.key));

describe("search", () => {
  it("matches English and Bangla synonyms", () => {
    expect(matchesQuery(textFor("en")("SERVICE"), "insemination")).toBe(true);
    expect(matchesQuery(textFor("en")("SERVICE"), "বীজ দেওয়া")).toBe(true);
    expect(matchesQuery(textFor("bn")("VACCINATION"), "টিকা")).toBe(true);
    expect(matchesQuery(textFor("en")("VACCINATION"), "টিকা")).toBe(true);
    expect(matchesQuery(textFor("en")("HEAT"), "weight")).toBe(false);
  });
  it("finds events by Bangla term even when the UI is English", () => {
    expect(keys(model({ query: "কৃত্রিম প্রজনন" }))).toContain("SERVICE");
  });
});

describe("browse", () => {
  it("hides blocked and warning events, lists eligible ones", () => {
    const m = model();
    expect(keys(m)).toContain("HEAT");
    expect(keys(m)).not.toContain("CASTRATE");
    expect(m.unavailable).toHaveLength(0);
  });
  it("Show all adds warnings and greyed blocked events", () => {
    const m = model({ showAll: true });
    expect(keys(m)).toContain("CALVING");
    expect(m.unavailable.map((e) => e.def.key)).toContain("CASTRATE");
  });
  it("puts Suggested first (max 3, never blocked) and Recent without duplicates", () => {
    const m = model({ suggestedKeys: ["PREG_CHECK", "DRY_OFF", "CALVING", "WEIGHT", "CASTRATE"], recentKeys: ["WEIGHT", "PREG_CHECK", "HEAT"] });
    expect(m.suggested.map((e) => e.def.key)).toEqual(["PREG_CHECK", "DRY_OFF", "CALVING"]);
    expect(m.recent.map((e) => e.def.key)).toEqual(["WEIGHT", "HEAT"]);
  });
});

describe("search results for an ineligible event", () => {
  it("'calving' on a bull is greyed with the reason", () => {
    const m = model({ facts: bull, query: "calving" });
    expect(keys(m)).not.toContain("CALVING");
    const greyed = m.unavailable.find((e) => e.def.key === "CALVING");
    expect(greyed?.eligibility).toEqual({ status: "block", reason: { key: "onlyFor", chips: ["female"] } });
  });
  it("a warning event is found normally in search", () => {
    expect(keys(model({ query: "calving" }))).toContain("CALVING");
  });
});

describe("RBAC", () => {
  it("never lists events the role may not record, even when searched", () => {
    const worker = (permission: string) => ["reproduction.heat", "cattle.update", "cattle.bcs", "healthcare.update"].includes(permission);
    const m = model({ can: worker, showAll: true });
    const all = [...keys(m), ...m.unavailable.map((e) => e.def.key)];
    expect(all).toContain("HEAT");
    expect(all).toContain("NOTE");
    expect(all).not.toContain("SELL");
    expect(all).not.toContain("SERVICE");
    expect(keys(model({ can: worker, query: "sell" }))).toEqual([]);
  });
});

describe("suggestedFromUpcoming", () => {
  it("maps actionable upcoming kinds to events, deduped, skipping info-only rows", () => {
    expect(
      suggestedFromUpcoming([
        { kind: "PREGNANCY_CHECK", actionable: true },
        { kind: "WITHDRAWAL_END", actionable: false },
        { kind: "PREGNANCY_CHECK", actionable: true },
        { kind: "DRY_OFF", actionable: true },
      ]),
    ).toEqual(["PREG_CHECK", "DRY_OFF"]);
  });
});
