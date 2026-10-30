import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import bn from "@/i18n/messages/bn.json";
import type { AnimalFacts } from "../types";
import { buildRequest, DISPOSE_EVENTS, FORM_DEFS, defaultValues, toEventAt, validateValues } from "./definitions";
import { clientFindings, findingMessageKey, isPastRecord, KNOWN_FINDING_CODES, previewFollowUps } from "./followups";

const def = (key: keyof typeof FORM_DEFS) => FORM_DEFS[key]!;
const when = { date: "2026-10-28", time: "07:30", historical: false };
const cow = (over: Partial<AnimalFacts> = {}): AnimalFacts => ({
  herdStatus: "ACTIVE", gender: "FEMALE", animalCategory: "COW", reproductiveStatus: "OPEN", productionStatus: "MILKING", dim: 90, ...over,
});

describe("form definitions", () => {
  it("every form has at most 3 required fields so it fits one phone screen with details closed", () => {
    for (const [key, d] of Object.entries(FORM_DEFS)) {
      expect(d!.fields.filter((f) => !f.detail).length, key).toBeLessThanOrEqual(3);
    }
  });
  it("covers every RFE-158 and RFE-159 event except the dispose ones", () => {
    for (const key of ["HEAT", "SERVICE", "PREG_CHECK", "CALVING", "ABORTION", "DRY_OFF", "TREATMENT", "VACCINATION", "DEWORMING", "WEIGHT", "BCS", "WEAN", "ENTER_FATTENING", "LEAVE_FATTENING", "MOVE", "NOTE"] as const) {
      expect(FORM_DEFS[key], key).toBeDefined();
    }
    expect(DISPOSE_EVENTS).toEqual(["SELL", "DEATH", "CULL"]);
  });
  it("every field label and option label exists in en and bn", () => {
    for (const messages of [en, bn]) {
      const events = (messages as unknown as { events: { fields: Record<string, string>; options: Record<string, Record<string, string>> } }).events;
      for (const d of Object.values(FORM_DEFS)) {
        for (const f of d!.fields) {
          expect(events.fields[f.name], `field ${f.name}`).toBeTruthy();
          if (f.optionLabels) continue; // labels live in an existing namespace (health conditions)
          for (const o of f.options ?? []) expect(events.options[f.name]?.[o], `option ${f.name}.${o}`).toBeTruthy();
        }
      }
    }
  });
});

describe("validateValues", () => {
  it("a preg check needs a result but no AI or breeding link", () => {
    expect(validateValues(def("PREG_CHECK"), {})).toEqual({ result: "required" });
    expect(validateValues(def("PREG_CHECK"), { result: "PREGNANT" })).toEqual({});
    expect(def("PREG_CHECK").fields.map((f) => f.name)).not.toContain("breedingEventId");
  });
  it("checks numeric ranges", () => {
    expect(validateValues(def("WEIGHT"), { weightKg: 5 })).toEqual({ weightKg: "range" });
    expect(validateValues(def("WEIGHT"), { weightKg: 412 })).toEqual({});
    expect(validateValues(def("BCS"), { score: 6 })).toEqual({ score: "range" });
  });
  it("Move needs a shed or a group, either is enough", () => {
    expect(Object.keys(validateValues(def("MOVE"), {}))).toEqual(["shedId", "groupId"]);
    expect(validateValues(def("MOVE"), { groupId: "g1" })).toEqual({});
  });
  it("a note needs its text", () => {
    expect(validateValues(def("NOTE"), { text: "Check hoof" })).toEqual({});
    expect(validateValues(def("NOTE"), {})).toEqual({ text: "required" });
  });
});

describe("buildRequest", () => {
  it("heat: backend type, payload, time of day, RECORDED", () => {
    const request = buildRequest(def("HEAT"), { ...defaultValues(def("HEAT")), standingHeat: true, mountingBehavior: false, notes: " seen at dawn " }, when);
    expect(request.type).toBe("HEAT");
    expect(request.provenance).toBe("RECORDED");
    expect(request.payload).toEqual({ detectionMethod: "VISUAL", standingHeat: true });
    expect(request.notes).toBe("seen at dawn");
    expect(request.eventAt).toBe(new Date("2026-10-28T07:30:00").toISOString());
  });
  it("events without a time are stamped at local noon", () => {
    expect(buildRequest(def("WEIGHT"), { weightKg: 412 }, when).eventAt).toBe(toEventAt("2026-10-28", undefined));
    expect(toEventAt("2026-10-28", undefined)).toBe(new Date("2026-10-28T12:00:00").toISOString());
  });
  it("maps client keys to backend types and sends HISTORICAL when asked", () => {
    expect(buildRequest(def("SERVICE"), { breedingMethod: "AI" }, { ...when, historical: true })).toMatchObject({ type: "BREEDING", provenance: "HISTORICAL" });
    expect(buildRequest(def("WEAN"), {}, when).type).toBe("WEANING");
  });
  it("sends only properties RecordEventDto accepts (forbidNonWhitelisted)", () => {
    const allowed = new Set(["type", "eventAt", "provenance", "notes", "sourceEventId", "payload"]);
    for (const d of Object.values(FORM_DEFS)) {
      const request = buildRequest(d!, { ...defaultValues(d!), notes: "n", text: "t" }, when);
      for (const key of Object.keys(request)) expect(allowed.has(key), `${d!.key}.${key}`).toBe(true);
    }
  });
  it("sends months pregnant as a gestation day, and weaning weight under the server name", () => {
    expect(buildRequest(def("PREG_CHECK"), { result: "PREGNANT", monthsPregnant: 3 }, when).payload).toEqual({ result: "PREGNANT", diagnosisMethod: undefined, gestationDay: 90 });
    expect(buildRequest(def("WEAN"), { weaningWeightKg: 90 }, when).payload).toEqual({ weaningWeightKg: 90 });
    expect(buildRequest(def("NOTE"), { text: "Check hoof" }, when).payload).toEqual({ text: "Check hoof" });
  });
  it("calving nests one calf row when a calf sex is given", () => {
    const request = buildRequest(def("CALVING"), { calvingEase: "NORMAL", calfCount: 1, calfGender: "FEMALE", calfTagNumber: "C-1", birthWeight: 28 }, when);
    expect(request.payload).toEqual({ calvingEase: "NORMAL", calfCount: 1, calves: [{ gender: "FEMALE", tagNumber: "C-1", birthWeight: 28, status: "ALIVE" }] });
    expect(buildRequest(def("CALVING"), { calvingEase: "NORMAL", calfCount: 1 }, when).payload).toEqual({ calvingEase: "NORMAL", calfCount: 1 });
  });
});

describe("what happens next", () => {
  const today = "2026-10-30";
  it("a service today leaves a pregnancy-check reminder in the future, ticked by default", () => {
    const [item] = previewFollowUps("SERVICE", {}, today, today);
    expect(item).toMatchObject({ key: "PREG_CHECK_AFTER_BREEDING", dueDate: "2026-12-04", pastDue: false });
  });
  it("an AI backdated 60 days gets a pregnancy-check reminder already past, so it starts unticked", () => {
    const [item] = previewFollowUps("SERVICE", {}, "2026-08-31", today);
    expect(item.dueDate).toBe("2026-10-05");
    expect(item.pastDue).toBe(true);
  });
  it("a positive check lists dry-off and calving due; a negative one lists nothing", () => {
    const items = previewFollowUps("PREG_CHECK", { result: "PREGNANT", expectedCalvingDate: "2027-04-02" }, today, today);
    expect(items.map((i) => [i.key, i.dueDate])).toEqual([
      ["DRY_OFF_BEFORE_CALVING", "2027-02-01"],
      ["CALVING_DUE", "2027-04-02"],
    ]);
    expect(previewFollowUps("PREG_CHECK", { result: "NOT_PREGNANT" }, today, today)).toEqual([]);
  });
  it("estimates calving from months pregnant when no date is given", () => {
    const items = previewFollowUps("PREG_CHECK", { result: "PREGNANT", monthsPregnant: 3 }, "2026-10-30", "2026-10-30");
    expect(items.find((i) => i.key === "CALVING_DUE")?.dueDate).toBe("2027-05-08");
  });
  it("past-record pre-tick starts after 7 days", () => {
    expect(isPastRecord("2026-10-23", today)).toBe(false);
    expect(isPastRecord("2026-10-22", today)).toBe(true);
  });
});

describe("client findings", () => {
  it("heat on a pregnant cow is an amber warning, never a block", () => {
    const findings = clientFindings("HEAT", cow({ reproductiveStatus: "PREGNANT" }), "2026-10-30", "2026-10-30");
    expect(findings).toEqual([{ code: "UNUSUAL_FOR_STATE", severity: "WARN", chips: ["pregnant"] }]);
  });
  it("a normal heat has no findings; a future date blocks", () => {
    expect(clientFindings("HEAT", cow(), "2026-10-30", "2026-10-30")).toEqual([]);
    expect(clientFindings("WEIGHT", cow(), "2026-11-02", "2026-10-30")).toEqual([{ code: "DATE_IN_FUTURE", severity: "BLOCK" }]);
  });
});

describe("health forms", () => {
  it("illness needs a condition and defaults severity to medium", () => {
    expect(validateValues(def("ILLNESS"), { severity: "MEDIUM" })).toEqual({ condition: "required" });
    const request = buildRequest(def("ILLNESS"), { ...defaultValues(def("ILLNESS")), condition: "MASTITIS", notes: "left hind quarter" }, when);
    expect(request).toMatchObject({ type: "ILLNESS", notes: "left hind quarter", payload: { condition: "MASTITIS", severity: "MEDIUM" } });
  });
  it("treatment needs a medicine and carries dose and vet cost", () => {
    expect(validateValues(def("TREATMENT"), {})).toEqual({ medicineName: "required" });
    expect(buildRequest(def("TREATMENT"), { medicineName: "Oxytetracycline", doseAmount: 10, doseUnit: "ml", vetCost: 500 }, when)).toMatchObject({
      type: "TREATMENT",
      payload: { medicineName: "Oxytetracycline", doseAmount: 10, doseUnit: "ml", vetCost: 500 },
    });
  });
  it("vaccination and deworming need a product and send dose, route and next dose days", () => {
    for (const key of ["VACCINATION", "DEWORMING"] as const) {
      expect(validateValues(def(key), {})).toEqual({ medicineName: "required" });
      expect(buildRequest(def(key), { medicineName: "FMD", doseAmount: 2, doseUnit: "ml", route: "IM", nextDoseDays: 180 }, when)).toMatchObject({
        type: key,
        payload: { medicineName: "FMD", doseAmount: 2, doseUnit: "ml", route: "IM", nextDoseDays: 180 },
      });
    }
    expect(validateValues(def("VACCINATION"), { medicineName: "FMD", nextDoseDays: 0 })).toEqual({ nextDoseDays: "range" });
  });
  it("next dose days feeds What happens next, and a backdated dose can already be past", () => {
    const today = "2026-10-30";
    expect(previewFollowUps("VACCINATION", { medicineName: "FMD" }, today, today)).toEqual([]);
    expect(previewFollowUps("VACCINATION", { medicineName: "FMD", nextDoseDays: 180 }, today, today)).toEqual([
      { key: "NEXT_DOSE", labelKey: "nextDose", dueDate: "2027-04-28", pastDue: false },
    ]);
    expect(previewFollowUps("DEWORMING", { medicineName: "X", nextDoseDays: 30 }, "2026-08-01", today)[0]).toMatchObject({ dueDate: "2026-08-31", pastDue: true });
  });
  it("every health form points to Healthcare while the server cannot record it", () => {
    for (const key of ["ILLNESS", "TREATMENT", "VACCINATION", "DEWORMING"] as const) expect(def(key).fallbackHref).toBe("/healthcare");
  });
});

describe("finding labels", () => {
  const texts = (messages: unknown) => (messages as { events: { form: { finding: Record<string, string> } } }).events.form.finding;
  it("every known code has a short sentence in en and bn", () => {
    for (const messages of [en, bn]) {
      for (const code of KNOWN_FINDING_CODES) expect(texts(messages)[code], code).toBeTruthy();
      for (const key of ["UNUSUAL_PATTERN", "GENERIC_WARN", "GENERIC_BLOCK"]) expect(texts(messages)[key], key).toBeTruthy();
    }
  });
  it("covers the codes the backend emits today", () => {
    for (const code of ["HEAT_WHILE_PREGNANT", "BREEDING_WHILE_PREGNANT", "CALVING_NO_PREGNANCY", "DRY_OFF_NO_LACTATION", "PREG_CHECK_NO_BREEDING", "PREG_CHECK_AFTER_BREEDING", "OPEN_CASE_EXISTS", "TREATMENT_NEW_CASE"]) {
      expect(findingMessageKey({ code, severity: "WARN" }), code).toBe(code);
    }
  });
  it("an unknown code falls back to a generic sentence for its severity, never the raw code", () => {
    expect(findingMessageKey({ code: "SOMETHING_NEW", severity: "WARN" })).toBe("GENERIC_WARN");
    expect(findingMessageKey({ code: "SOMETHING_NEW", severity: "BLOCK" })).toBe("GENERIC_BLOCK");
    expect(findingMessageKey({ code: "INFO_THING", severity: "INFO" })).toBe("GENERIC_WARN");
    for (const messages of [en, bn]) {
      for (const key of ["GENERIC_WARN", "GENERIC_BLOCK", "UNUSUAL_PATTERN"]) expect(texts(messages)[key]).not.toMatch(/[A-Z]{3,}_[A-Z]/);
    }
  });
  it("type-specific NOT_FOR and UNUSUAL_FOR warnings share one sentence", () => {
    expect(findingMessageKey({ code: "HEAT_NOT_FOR_CALVES", severity: "WARN" })).toBe("UNUSUAL_PATTERN");
    expect(findingMessageKey({ code: "BREEDING_UNUSUAL_FOR_FATTENING", severity: "WARN" })).toBe("UNUSUAL_PATTERN");
  });
});
