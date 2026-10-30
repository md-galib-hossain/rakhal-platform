import { todayLocalIso } from "@/lib/local-date";
import type { EventKey } from "../types";
import type { EventRequest, FieldDef, FormDef, FormValues } from "./types";

const MEDICINE_ROUTES = ["IM", "IV", "SC", "ORAL", "TOPICAL", "OTHER"];
const notes: FieldDef = { name: "notes", kind: "textarea", detail: true, target: "notes" };
const bool = (name: string): FieldDef => ({ name, kind: "bool", detail: true });

/**
 * Declarative form per event (RFE-158 reproduction, RFE-159 the rest): required fields first, everything else under
 * "More details", so each form fits one 375px screen with details closed (03 §5.2). `payload` keys follow the existing
 * per-domain DTOs; the backend's real payload schemas (RAKHAL-481) are not published yet, so they may need renaming.
 */
export const FORM_DEFS: Partial<Record<EventKey, FormDef>> = {
  HEAT: {
    key: "HEAT",
    backendType: "HEAT",
    showTime: true,
    fields: [
      { name: "detectionMethod", kind: "segmented", required: true, options: ["VISUAL", "MANUAL", "COLLAR_SENSOR", "PEDOMETER"], default: "VISUAL" },
      bool("standingHeat"),
      bool("mucusDischarge"),
      bool("mountingBehavior"),
      bool("restlessness"),
      notes,
    ],
  },
  SERVICE: {
    key: "SERVICE",
    backendType: "BREEDING",
    showTime: true,
    fields: [
      { name: "breedingMethod", kind: "segmented", required: true, options: ["AI", "NATURAL", "EMBRYO_TRANSFER"], default: "AI" },
      { name: "sireNameOrCode", kind: "text", detail: true },
      { name: "inseminator", kind: "text", detail: true },
      // A live AI must say who supplied the semen and what it cost (RAKHAL-330); a past record needs neither. The server's
      // dry run reports it when missing, so these stay under "More details" to keep the form one screen.
      { name: "semenSource", kind: "segmented", detail: true, options: ["TECHNICIAN_SUPPLIED", "EXTERNAL"] },
      { name: "serviceCost", kind: "number", detail: true, min: 0, step: 1, unit: "৳" },
      { name: "paymentMethod", kind: "segmented", detail: true, options: ["CASH", "BANK_TRANSFER", "MFS"] },
      notes,
    ],
  },
  PREG_CHECK: {
    key: "PREG_CHECK",
    backendType: "PREG_CHECK",
    fields: [
      { name: "result", kind: "segmented", required: true, options: ["PREGNANT", "NOT_PREGNANT", "SUSPECTED"] },
      { name: "diagnosisMethod", kind: "segmented", detail: true, options: ["PALPATION", "ULTRASOUND", "LAB"], default: "PALPATION" },
      { name: "monthsPregnant", kind: "number", detail: true, min: 0, max: 10, step: 0.5 },
      { name: "expectedCalvingDate", kind: "date", detail: true },
      notes,
    ],
    // The server takes `gestationDay`, not months: "about 3 months pregnant" is sent as ~90 days and the calving date follows.
    transform: (payload) => {
      const { monthsPregnant, ...rest } = payload;
      if (typeof monthsPregnant !== "number" || rest.gestationDay !== undefined) return rest;
      return { ...rest, gestationDay: Math.round(monthsPregnant * 30) };
    },
  },
  CALVING: {
    key: "CALVING",
    backendType: "CALVING",
    showTime: true,
    fields: [
      { name: "calvingEase", kind: "segmented", required: true, options: ["NORMAL", "ASSISTED", "DIFFICULT", "CESAREAN"], default: "NORMAL" },
      { name: "calfCount", kind: "number", required: true, min: 1, max: 4, step: 1, default: 1 },
      { name: "calfGender", kind: "segmented", detail: true, options: ["FEMALE", "MALE"] },
      { name: "calfTagNumber", kind: "text", detail: true },
      { name: "birthWeight", kind: "number", detail: true, min: 5, max: 80, step: 0.5, unit: "kg" },
      notes,
    ],
    // One calf row when a gender was given; the calf list for twins is edited from the calf record.
    transform: (payload) => {
      const { calfGender, calfTagNumber, birthWeight, ...rest } = payload;
      if (!calfGender) return rest;
      return { ...rest, calves: [{ gender: calfGender, tagNumber: calfTagNumber, birthWeight, status: "ALIVE" }] };
    },
  },
  ABORTION: {
    key: "ABORTION",
    backendType: "ABORTION",
    fields: [
      { name: "gestationDay", kind: "number", detail: true, min: 0, max: 300, step: 1 },
      { name: "suspectedCause", kind: "text", detail: true },
      notes,
    ],
  },
  DRY_OFF: {
    key: "DRY_OFF",
    backendType: "DRY_OFF",
    fields: [
      {
        name: "reason",
        kind: "segmented",
        required: true,
        options: ["SCHEDULED", "LOW_PRODUCTION", "HEALTH", "PREGNANCY", "MANAGEMENT_DECISION"],
        default: "SCHEDULED",
      },
      notes,
    ],
  },
  // Health events (RFE-159 + Wave 3 follow-up). The backend is wiring these through POST /cattle/:id/events; until a
  // handler answers 201 the panel shows "not available yet" with a link to Healthcare (`fallbackHref`).
  ILLNESS: {
    key: "ILLNESS",
    backendType: "ILLNESS",
    fallbackHref: "/healthcare",
    fields: [
      {
        name: "condition",
        kind: "select",
        required: true,
        optionLabels: "health.reportSickness.conditionValue",
        options: ["MASTITIS", "LAMENESS", "METRITIS", "KETOSIS", "MILK_FEVER", "FEVER", "INJURY", "OTHER"],
      },
      { name: "severity", kind: "segmented", options: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "MEDIUM" },
      { name: "symptoms", kind: "text", detail: true },
      notes,
    ],
  },
  TREATMENT: {
    key: "TREATMENT",
    backendType: "TREATMENT",
    fallbackHref: "/healthcare",
    fields: [
      { name: "medicineId", kind: "medicine", requiredWhenLive: true },
      { name: "doseAmount", kind: "number", requiredWhenLive: true, min: 0.01, step: 0.1 },
      { name: "doseUnit", kind: "text", requiredWhenLive: true },
      { name: "route", kind: "select", requiredWhenLive: true, options: MEDICINE_ROUTES },
      { name: "medicineName", kind: "text", detail: true },
      { name: "vetCost", kind: "number", detail: true, min: 0, step: 1, unit: "৳" },
      notes,
    ],
  },
  VACCINATION: {
    key: "VACCINATION",
    backendType: "VACCINATION",
    fallbackHref: "/healthcare",
    fields: [
      { name: "medicineId", kind: "medicine", requiredWhenLive: true },
      { name: "doseAmount", kind: "number", requiredWhenLive: true, min: 0.01, step: 0.1 },
      { name: "doseUnit", kind: "text", requiredWhenLive: true },
      { name: "route", kind: "select", requiredWhenLive: true, options: MEDICINE_ROUTES },
      { name: "medicineName", kind: "text", detail: true },
      { name: "nextDoseDays", kind: "number", detail: true, min: 1, max: 730, step: 1 },
      notes,
    ],
  },
  DEWORMING: {
    key: "DEWORMING",
    backendType: "DEWORMING",
    fallbackHref: "/healthcare",
    fields: [
      { name: "medicineId", kind: "medicine", requiredWhenLive: true },
      { name: "doseAmount", kind: "number", requiredWhenLive: true, min: 0.01, step: 0.1 },
      { name: "doseUnit", kind: "text", requiredWhenLive: true },
      { name: "route", kind: "select", requiredWhenLive: true, options: MEDICINE_ROUTES },
      { name: "medicineName", kind: "text", detail: true },
      { name: "nextDoseDays", kind: "number", detail: true, min: 1, max: 730, step: 1 },
      notes,
    ],
  },
  WEIGHT: {
    key: "WEIGHT",
    backendType: "WEIGHT",
    fields: [{ name: "weightKg", kind: "number", required: true, min: 10, max: 2000, step: 0.5, unit: "kg" }, notes],
  },
  BCS: {
    key: "BCS",
    backendType: "BCS",
    fields: [{ name: "score", kind: "number", required: true, min: 1, max: 5, step: 0.25 }, notes],
  },
  WEAN: {
    key: "WEAN",
    backendType: "WEANING",
    fields: [{ name: "weaningWeightKg", kind: "number", detail: true, min: 10, max: 400, step: 0.5, unit: "kg" }, notes],
  },
  CASTRATE: { key: "CASTRATE", backendType: "CASTRATION", fields: [notes] },
  ENTER_FATTENING: { key: "ENTER_FATTENING", backendType: "ENTER_FATTENING", fields: [notes] },
  LEAVE_FATTENING: { key: "LEAVE_FATTENING", backendType: "LEAVE_FATTENING", fields: [notes] },
  MOVE: {
    key: "MOVE",
    backendType: "MOVE",
    requireOneOf: ["shedId", "groupId"],
    fields: [
      { name: "shedId", kind: "shed" },
      { name: "groupId", kind: "group" },
      notes,
    ],
  },
  NOTE: {
    key: "NOTE",
    backendType: "NOTE",
    // The server stores a note's text in `payload.text` (animal-event-write.service.ts).
    fields: [{ name: "text", kind: "textarea", required: true }],
  },
};

/** Events that open the existing dispose dialog instead of a form (sell / death / cull). */
export const DISPOSE_EVENTS: EventKey[] = ["SELL", "DEATH", "CULL"];

export type FieldError = "required" | "range";

function isFilled(value: unknown): boolean {
  return value !== undefined && value !== "" && value !== null && !(typeof value === "number" && Number.isNaN(value));
}

/** Required fields, `requireOneOf`, and numeric ranges. Returns an error code per failing field name. */
export function validateValues(def: FormDef, values: FormValues, opts: { historical?: boolean } = {}): Record<string, FieldError> {
  const errors: Record<string, FieldError> = {};
  const oneOf = new Set(def.requireOneOf ?? []);
  const oneOfOk = oneOf.size === 0 || [...oneOf].some((name) => isFilled(values[name]));
  for (const field of def.fields) {
    const value = values[field.name];
    if (oneOf.has(field.name)) {
      if (!oneOfOk) errors[field.name] = "required";
      continue;
    }
    const required = field.required || (field.requiredWhenLive && !opts.historical);
    if (required && !isFilled(value) && field.kind !== "bool") errors[field.name] = "required";
    if (field.kind === "number" && isFilled(value)) {
      const n = Number(value);
      if ((field.min !== undefined && n < field.min) || (field.max !== undefined && n > field.max)) errors[field.name] = "range";
    }
  }
  return errors;
}

export function defaultValues(def: FormDef): FormValues {
  const values: FormValues = {};
  for (const field of def.fields) if (field.default !== undefined) values[field.name] = field.default;
  return values;
}

/** Combines the picked day and time into an instant. Without a time the event is stamped at local noon so no timezone moves it to another day. */
export function toEventAt(date: string, time: string | undefined): string {
  // Today without a time is "now": local noon would be in the future before midday and the server blocks future dates.
  if (!time && date === todayLocalIso()) return new Date().toISOString();
  return new Date(`${date}T${time || "12:00"}:00`).toISOString();
}

export function buildRequest(
  def: FormDef,
  values: FormValues,
  when: { date: string; time?: string; historical: boolean },
): EventRequest {
  let payload: Record<string, unknown> = {};
  let notesValue: string | undefined;
  for (const field of def.fields) {
    const value = values[field.name];
    if (!isFilled(value) || (field.kind === "bool" && value === false)) continue;
    const typed = field.kind === "number" ? Number(value) : typeof value === "string" ? value.trim() : value;
    if (field.target === "notes") notesValue = typed as string;
    else payload[field.name] = typed;
  }
  if (def.transform) payload = def.transform(payload);
  return {
    type: def.backendType,
    eventAt: toEventAt(when.date, def.showTime ? when.time : undefined),
    provenance: when.historical ? "HISTORICAL" : "RECORDED",
    ...(notesValue ? { notes: notesValue } : {}),
    payload,
  };
}
