import { describe, expect, it } from "vitest";
import { createTranslator } from "next-intl";
import en from "@/i18n/messages/en.json";
import { TIMELINE_TYPES, type TimelineEventType } from "../timeline-model";
import { formatEventSummary, safeText, type SummarySource } from "./summary";

const tSummary = createTranslator({ locale: "en", messages: en, namespace: "events.timeline.summary" });
const tOptions = createTranslator({ locale: "en", messages: en, namespace: "events.options" });
const tCondition = createTranslator({ locale: "en", messages: en, namespace: "health.reportSickness.conditionValue" });

const labels = {
  t: (key: string, values?: Record<string, string | number>) => tSummary(key as never, values as never),
  option: (group: string, value: unknown) =>
    typeof value === "string" && tOptions.has(`${group}.${value}` as never) ? tOptions(`${group}.${value}` as never) : null,
  condition: (value: unknown) => (typeof value === "string" && tCondition.has(value as never) ? tCondition(value as never) : null),
};

const sum = (type: TimelineEventType, detail: Record<string, unknown> | null, data: Record<string, unknown> | null = null) =>
  formatEventSummary({ type, detail, data } as SummarySource, labels);

describe("formatEventSummary (live GET /cattle/:id/events shapes)", () => {
  it("HEAT: signs then the detection method", () => {
    expect(sum("HEAT", { detectionMethod: "VISUAL", standingHeat: true, mucusDischarge: true, mountingBehavior: false })).toBe("Standing, Mucus · Seen");
    expect(sum("HEAT", { detectionMethod: "COLLAR_SENSOR", standingHeat: false })).toBe("Collar");
  });
  it("BREEDING: method, bull, technician; a seeded or id-like bull is dropped", () => {
    expect(sum("BREEDING", { breedingMethod: "AI", sireNameOrCode: "Sultan", inseminator: "Karim" })).toBe("AI · bull Sultan · by Karim");
    expect(sum("BREEDING", { breedingMethod: "AI", sireNameOrCode: null, semenSource: "EXTERNAL" })).toBe("AI");
    expect(sum("BREEDING", { breedingMethod: "NATURAL", sireNameOrCode: "E2E-RAKHAL346-bull-1793" })).toBe("Natural");
    expect(sum("BREEDING", { breedingMethod: "AI", sireNameOrCode: "cmvuwwec8000aqwfcqd32fv15" })).toBe("AI");
  });
  it("PREG_CHECK: result, day, method", () => {
    expect(sum("PREG_CHECK", { result: "PREGNANT", gestationDay: 60, diagnosisMethod: "PALPATION" })).toBe("Pregnant · day 60 · Palpation");
    expect(sum("PREG_CHECK", { result: "NOT_PREGNANT", gestationDay: null, diagnosisMethod: "ULTRASOUND" })).toBe("Not pregnant · Ultrasound");
  });
  it("CALVING: calf count and ease", () => {
    expect(sum("CALVING", { calfCount: 1, calvingEase: "NORMAL" })).toBe("1 calf · Normal");
    expect(sum("CALVING", { calfCount: 2, calvingEase: "ASSISTED" })).toBe("2 calves · Assisted");
  });
  it("ABORTION: day and cause", () => {
    expect(sum("ABORTION", { gestationDay: 120, suspectedCause: "Fall" })).toBe("day 120 · Fall");
    expect(sum("ABORTION", { gestationDay: null, suspectedCause: null })).toBeNull();
  });
  it("DRY_OFF: reason label, none when unset", () => {
    expect(sum("DRY_OFF", { reason: "LOW_PRODUCTION" })).toBe("Low production");
    expect(sum("DRY_OFF", { reason: null })).toBeNull();
  });
  it("ILLNESS: condition label; the case id in data is never shown", () => {
    expect(sum("ILLNESS", null, { healthCaseId: "cmvuwa1of001d08fcbsr0b9m7" })).toBeNull();
    expect(sum("ILLNESS", null, { condition: "MASTITIS" })).toBe("Mastitis");
    expect(sum("ILLNESS", null, { condition: "SOMETHING_NEW" })).toBeNull();
  });
  it("TREATMENT: product, dose (Decimal string), route; a seeded product name is dropped", () => {
    expect(sum("TREATMENT", { medicineName: "Oxytetracycline", doseAmount: "2.50", doseUnit: "ml", route: "IM" })).toBe("Oxytetracycline · 2.5 ml · Muscle (IM)");
    expect(sum("TREATMENT", { medicineName: "E2E LowStock Med 1793360210822", doseAmount: "1", doseUnit: "ml", route: "IM" })).toBe("1 ml · Muscle (IM)");
  });
  it("VACCINATION: product, dose, route and the next dose from the payload", () => {
    expect(sum("VACCINATION", { medicineName: "FMD", doseAmount: "2", doseUnit: "mL", route: "SC" }, { nextDoseDays: 180 })).toBe("FMD · 2 mL · Under skin (SC) · next in 180 days");
  });
  it("DEWORMING: product, dose, route", () => {
    expect(sum("DEWORMING", { medicineName: "Albendazole", doseAmount: "1", doseUnit: "mL", route: "ORAL" })).toBe("Albendazole · 1 mL · By mouth");
  });
  it("WEIGHT / BCS / WEANING: numbers", () => {
    expect(sum("WEIGHT", { weightKg: 310 })).toBe("310 kg");
    expect(sum("BCS", { score: 3.5 })).toBe("BCS 3.5");
    expect(sum("WEANING", { weaningWeightKg: 92 })).toBe("92 kg");
    expect(sum("WEANING", { weaningWeightKg: null })).toBeNull();
  });
  it("MOVE: shed and group names when the payload has them", () => {
    expect(sum("MOVE", null, { shedName: "Shed A", groupName: "Milking" })).toBe("Shed A · Milking");
    expect(sum("MOVE", null, { shedId: "cmvuwwec8000aqwfcqd32fv15" })).toBeNull();
  });
  it("SOLD / CULLED / DIED: price, reason, cause", () => {
    expect(sum("SOLD", { price: "85000", reason: "Surplus" })).toBe("৳85000 · Surplus");
    expect(sum("CULLED", { reason: "Low yield" })).toBe("Low yield");
    expect(sum("DIED", { primaryCauseOfDeath: "Bloat" })).toBe("Bloat");
    expect(sum("DIED", { primaryCauseOfDeath: "FOREIGN_BODY" })).toBeNull();
  });
  it("NOTE: the text; CUSTOM: values only, never keys", () => {
    expect(sum("NOTE", null, { text: "Limping slightly" })).toBe("Limping slightly");
    expect(sum("CUSTOM", null, { minutes: 5, product: "A" })).toBe("5 · A");
  });
  it("types with no detail return null", () => {
    for (const type of ["CASTRATION", "ENTER_FATTENING", "LEAVE_FATTENING", "HOOF_TRIM", "DEHORN"] as const) expect(sum(type, null)).toBeNull();
  });
  it("covers every event type without throwing on an empty row, and never prints an id", () => {
    for (const type of TIMELINE_TYPES) {
      const out = sum(type, {}, {});
      expect(out === null || !/cmv[a-z0-9]{15,}|E2E/.test(out)).toBe(true);
    }
  });
});

describe("safeText", () => {
  it("drops ids, seeded names and enum keys; keeps real text", () => {
    expect(safeText("cmvuwa1of001d08fcbsr0b9m7")).toBeNull();
    expect(safeText("ae_f8ca06241eb142a1a05651516119e944")).toBeNull();
    expect(safeText("E2E-RAKHAL346-x")).toBeNull();
    expect(safeText("FOREIGN_BODY")).toBeNull();
    expect(safeText("  ")).toBeNull();
    expect(safeText(" Sultan ")).toBe("Sultan");
  });
});
