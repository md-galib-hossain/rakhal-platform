import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import { ANIMAL_CHIPS, EVENT_KEYS, type AnimalFacts } from "../types";
import { deriveChips } from "./chips";
import { EVENT_BY_KEY, EVENT_CATALOGUE } from "./events";
import { eligibilityByKey } from "./eligibility";

const base = { herdStatus: "ACTIVE" as const };
const cow = (over: Partial<AnimalFacts> = {}): AnimalFacts => ({
  ...base, gender: "FEMALE", animalCategory: "COW", reproductiveStatus: "OPEN", productionStatus: "MILKING", dim: 96, ...over,
});
const heifer = (over: Partial<AnimalFacts> = {}): AnimalFacts => ({
  ...base, gender: "FEMALE", animalCategory: "HEIFER", lifecycleSubStage: "BREEDING_HEIFER", productionStatus: null, ...over,
});
const calf = (over: Partial<AnimalFacts> = {}): AnimalFacts => ({ ...base, gender: "FEMALE", animalCategory: "CALF", ...over });
const bull = (over: Partial<AnimalFacts> = {}): AnimalFacts => ({ ...base, gender: "MALE", animalCategory: "BULL", ...over });
const steer = (over: Partial<AnimalFacts> = {}): AnimalFacts => ({ ...base, gender: "CASTRATED_MALE", animalCategory: "STEER", ...over });

describe("deriveChips — one test per chip", () => {
  it("female / male", () => {
    expect(deriveChips(cow()).has("female")).toBe(true);
    expect(deriveChips(cow()).has("male")).toBe(false);
    expect(deriveChips(bull()).has("male")).toBe(true);
    expect(deriveChips(steer()).has("male")).toBe(true);
  });
  it("calves", () => {
    expect(deriveChips(calf()).has("calves")).toBe(true);
    expect(deriveChips(cow()).has("calves")).toBe(false);
  });
  it("weaned", () => {
    expect(deriveChips(heifer({ lifecycleSubStage: "WEANED_HEIFER" })).has("weaned")).toBe(true);
    expect(deriveChips(bull({ lifecycleSubStage: "WEANER_BULL" })).has("weaned")).toBe(true);
    expect(deriveChips(heifer()).has("weaned")).toBe(false);
  });
  it("heifers / cows", () => {
    expect(deriveChips(heifer()).has("heifers")).toBe(true);
    expect(deriveChips(cow()).has("cows")).toBe(true);
    expect(deriveChips(cow()).has("heifers")).toBe(false);
  });
  it("pregnant", () => {
    expect(deriveChips(cow({ reproductiveStatus: "PREGNANT" })).has("pregnant")).toBe(true);
    expect(deriveChips(cow()).has("pregnant")).toBe(false);
  });
  it("open — breeding-age, not pregnant, not bred-awaiting-check", () => {
    expect(deriveChips(cow()).has("open")).toBe(true);
    expect(deriveChips(heifer()).has("open")).toBe(true);
    expect(deriveChips(cow({ reproductiveStatus: "PREGNANT" })).has("open")).toBe(false);
    expect(deriveChips(cow({ reproductiveStatus: "BRED_AWAITING_CONFIRMATION" })).has("open")).toBe(false);
    expect(deriveChips(heifer({ lifecycleSubStage: "GROWING_HEIFER" })).has("open")).toBe(false);
    expect(deriveChips(calf()).has("open")).toBe(false);
    expect(deriveChips(bull()).has("open")).toBe(false);
  });
  it("milking / dry", () => {
    expect(deriveChips(cow()).has("milking")).toBe(true);
    expect(deriveChips(cow({ productionStatus: "DRY" })).has("dry")).toBe(true);
    expect(deriveChips(cow({ productionStatus: "DRY" })).has("milking")).toBe(false);
  });
  it("fresh — milking and DIM within the farm setting", () => {
    expect(deriveChips(cow({ dim: 10 })).has("fresh")).toBe(true);
    expect(deriveChips(cow({ dim: 21 })).has("fresh")).toBe(true);
    expect(deriveChips(cow({ dim: 22 })).has("fresh")).toBe(false);
    expect(deriveChips(cow({ dim: 40 }), 60).has("fresh")).toBe(true);
    expect(deriveChips(cow({ productionStatus: "DRY", dim: 5 })).has("fresh")).toBe(false);
  });
  it("fattening", () => {
    expect(deriveChips(steer({ purpose: "FATTENING" })).has("fattening")).toBe(true);
    expect(deriveChips(steer()).has("fattening")).toBe(false);
  });
  it("covers every chip name in the type list", () => {
    expect(ANIMAL_CHIPS).toHaveLength(12);
  });
});

describe("eligibility (04 §3)", () => {
  const status = (key: Parameters<typeof eligibilityByKey>[0], facts: AnimalFacts) => eligibilityByKey(key, facts).status;

  it("heat: open cow ok, pregnant cow warns, bull/calf blocked", () => {
    expect(status("HEAT", cow())).toBe("ok");
    expect(status("HEAT", cow({ reproductiveStatus: "PREGNANT" }))).toBe("warn");
    expect(status("HEAT", bull())).toBe("block");
    expect(status("HEAT", calf())).toBe("block");
    expect(status("HEAT", heifer())).toBe("ok");
  });
  it("calving on a bull reports 'only for female'", () => {
    expect(eligibilityByKey("CALVING", bull())).toEqual({ status: "block", reason: { key: "onlyFor", chips: ["female"] } });
  });
  it("calving: pregnant milking cow is fine, open cow warns", () => {
    expect(status("CALVING", cow({ reproductiveStatus: "PREGNANT" }))).toBe("ok");
    expect(status("CALVING", cow())).toBe("warn");
    expect(status("CALVING", cow({ reproductiveStatus: "PREGNANT", productionStatus: "DRY" }))).toBe("ok");
  });
  it("preg check: heifer / cow ok, fattening cow warns, calf blocked", () => {
    expect(status("PREG_CHECK", heifer())).toBe("ok");
    expect(status("PREG_CHECK", cow({ purpose: "FATTENING" }))).toBe("warn");
    expect(status("PREG_CHECK", calf())).toBe("block");
  });
  it("dry off: milking cow ok, dry cow and heifer blocked", () => {
    expect(status("DRY_OFF", cow({ reproductiveStatus: "PREGNANT" }))).toBe("ok");
    expect(status("DRY_OFF", cow({ productionStatus: "DRY" }))).toBe("block");
    expect(status("DRY_OFF", heifer())).toBe("block");
  });
  it("abortion: pregnant ok, open warns", () => {
    expect(status("ABORTION", cow({ reproductiveStatus: "PREGNANT" }))).toBe("ok");
    expect(status("ABORTION", cow())).toBe("warn");
  });
  it("health events are listed for every kind of animal", () => {
    for (const facts of [cow(), heifer(), calf(), bull(), steer(), cow({ reproductiveStatus: "PREGNANT" }), cow({ productionStatus: "DRY" })]) {
      expect(status("TREATMENT", facts)).toBe("ok");
      expect(status("VACCINATION", facts)).toBe("ok");
      expect(status("WEIGHT", facts)).toBe("ok");
    }
  });
  it("BCS warns for a calf", () => {
    expect(status("BCS", calf())).toBe("warn");
    expect(status("BCS", cow())).toBe("ok");
  });
  it("wean: calves only", () => {
    expect(status("WEAN", calf())).toBe("ok");
    expect(status("WEAN", heifer())).toBe("block");
    expect(status("WEAN", bull())).toBe("block");
  });
  it("castrate: bull ok, steer already done, cow blocked", () => {
    expect(status("CASTRATE", bull())).toBe("ok");
    expect(eligibilityByKey("CASTRATE", steer())).toEqual({ status: "block", reason: { key: "alreadyCastrated" } });
    expect(status("CASTRATE", cow())).toBe("block");
  });
  it("fattening: enter for a steer, leave only while fattening", () => {
    expect(status("ENTER_FATTENING", steer())).toBe("ok");
    expect(status("ENTER_FATTENING", steer({ purpose: "FATTENING" }))).toBe("block");
    expect(status("ENTER_FATTENING", calf())).toBe("warn");
    expect(status("LEAVE_FATTENING", steer())).toBe("block");
    expect(status("LEAVE_FATTENING", steer({ purpose: "FATTENING" }))).toBe("ok");
  });
  it("an animal that left the herd can only take a note", () => {
    expect(status("NOTE", cow({ herdStatus: "SOLD" }))).toBe("ok");
    expect(eligibilityByKey("TREATMENT", cow({ herdStatus: "DECEASED" }))).toEqual({ status: "block", reason: { key: "leftHerd" } });
  });
});

describe("catalogue integrity", () => {
  it("has one entry per event key", () => {
    expect(EVENT_CATALOGUE.map((d) => d.key).sort()).toEqual([...EVENT_KEYS].sort());
    expect(Object.keys(EVENT_BY_KEY)).toHaveLength(EVENT_KEYS.length);
  });
  it("every label, hint, synonym, chip and group exists in en and bn", () => {
    for (const messages of [en, bn]) {
      const events = (messages as unknown as { events: Record<string, Record<string, unknown>> }).events;
      for (const def of EVENT_CATALOGUE) {
        const entry = events.catalogue[def.key] as { label: string; hint: string; synonyms: string };
        expect(entry.label, `${def.key}.label`).toBeTruthy();
        expect(entry.hint, `${def.key}.hint`).toBeTruthy();
        expect(entry.synonyms, `${def.key}.synonyms`).toBeTruthy();
        expect(events.group[def.group], def.group).toBeTruthy();
      }
      for (const chip of ANIMAL_CHIPS) expect(events.chip[chip], chip).toBeTruthy();
    }
  });
});
