import { addDaysLocalIso } from "@/lib/local-date";
import { deriveChips } from "../catalogue/chips";
import { EVENT_BY_KEY } from "../catalogue/events";
import { eligibilityFor } from "../catalogue/eligibility";
import type { AnimalFacts, EventKey } from "../types";
import type { Finding, FollowUpPreview, FormValues } from "./types";

/** Farm setting `reproPregnancyCheckDays` (default 35); pass the real value once settings serve it to the workspace. */
export const DEFAULT_PREG_CHECK_DAYS = 35;
/** Gestation length used to estimate a calving date from "months pregnant" (04 §5.C). */
const GESTATION_DAYS = 280;
const DRY_OFF_BEFORE_CALVING_DAYS = 60;
/** A date older than this pre-ticks "This is a past record" (HISTORICAL), 03 §5. */
export const PAST_RECORD_AFTER_DAYS = 7;

function diffDays(from: string, to: string): number {
  return Math.round((new Date(`${to}T00:00:00`).getTime() - new Date(`${from}T00:00:00`).getTime()) / 86_400_000);
}

export function isPastRecord(date: string, today: string): boolean {
  return diffDays(date, today) > PAST_RECORD_AFTER_DAYS;
}

function item(key: string, labelKey: string, dueDate: string | null, today: string): FollowUpPreview {
  return { key, labelKey, dueDate, pastDue: dueDate !== null && dueDate < today };
}

/**
 * "What happens next" without the server: the rules of 04 §3.6 that matter on a form. A follow-up whose due day has
 * already passed is returned with `pastDue` so the UI leaves it unticked ("already past"): backdating an AI by 60 days
 * must not create an overdue pregnancy-check reminder unless the user ticks it (03 §5).
 */
export function previewFollowUps(
  key: EventKey,
  values: FormValues,
  date: string,
  today: string,
  pregCheckDays: number = DEFAULT_PREG_CHECK_DAYS,
): FollowUpPreview[] {
  switch (key) {
    case "SERVICE":
      return [item("PREG_CHECK_AFTER_BREEDING", "pregCheck", addDaysLocalIso(date, pregCheckDays), today)];
    case "HEAT":
      return [item("HEAT_WATCH_AFTER_HEAT", "returnHeatWatch", addDaysLocalIso(date, 21), today)];
    case "ABORTION":
      return [item("HEAT_WATCH_AFTER_ABORTION", "returnHeatWatch", addDaysLocalIso(date, 21), today)];
    case "CALVING":
      return [item("FRESH_CHECK_AFTER_CALVING", "freshCheck", addDaysLocalIso(date, 7), today)];
    case "VACCINATION":
    case "DEWORMING": {
      // "Next dose in N days" (booster / next round) feeds the reminder; nothing is listed without it.
      const days = values.nextDoseDays;
      if (typeof days !== "number" || !Number.isFinite(days) || days < 1) return [];
      return [item("NEXT_DOSE", "nextDose", addDaysLocalIso(date, Math.round(days)), today)];
    }
    case "PREG_CHECK": {
      if (values.result !== "PREGNANT") return [];
      const expected =
        typeof values.expectedCalvingDate === "string" && values.expectedCalvingDate
          ? values.expectedCalvingDate
          : typeof values.monthsPregnant === "number" && values.monthsPregnant >= 0
            ? addDaysLocalIso(date, GESTATION_DAYS - Math.round(values.monthsPregnant * 30))
            : null;
      if (!expected) return [];
      return [
        item("DRY_OFF_BEFORE_CALVING", "dryOff", addDaysLocalIso(expected, -DRY_OFF_BEFORE_CALVING_DAYS), today),
        item("CALVING_DUE", "calvingDue", expected, today),
      ];
    }
    default:
      return [];
  }
}

/**
 * Finding codes with their own sentence in `events.form.finding.*` (en + bn). The backend emits these today
 * (`animal-events/domain/findings.ts` + the health handlers) plus the client-side ones below.
 */
export const KNOWN_FINDING_CODES = [
  "HEAT_WHILE_PREGNANT",
  "BREEDING_WHILE_PREGNANT",
  "CALVING_NO_PREGNANCY",
  "DRY_OFF_NO_LACTATION",
  "DRY_OFF_ALREADY_DRY",
  "PREG_CHECK_NO_BREEDING",
  "PREG_CHECK_AFTER_BREEDING",
  "ALREADY_IN_FATTENING",
  "OPEN_CASE_EXISTS",
  "TREATMENT_NEW_CASE",
  "EVENT_WRONG_SEX",
  "EVENT_DATE_IN_FUTURE",
  "EVENT_DATE_BEFORE_BIRTH",
  "EVENT_AFTER_EXIT",
  "EVENT_PRECONDITION_FAILED",
  "UNUSUAL_FOR_STATE",
  "DATE_IN_FUTURE",
  "DATE_BEFORE_BIRTH",
  "HEAT_ON_PREGNANT",
  "BREEDING_ON_ACTIVE_PREGNANCY",
  "BREEDING_IN_VWP",
  "CHECK_TOO_EARLY",
  "GESTATION_SHORT",
  "CALVING_INTERVAL_SHORT",
  "DRY_OFF_NOT_MILKING",
  "POSSIBLE_DUPLICATE",
  "WEIGHT_JUMP",
  "BCS_JUMP",
] as const;

/** Codes shaped `<TYPE>_NOT_FOR_*` / `<TYPE>_UNUSUAL_FOR_*` are the generic "wrong kind of animal" warning from the backend. */
const UNUSUAL_PATTERN = /_(NOT|UNUSUAL)_FOR_/;

/**
 * Which `events.form.finding.*` key to show for a finding. An unknown code never reaches the screen as a raw code: it
 * becomes the generic sentence for its severity (a BLOCK says it cannot be saved as entered, a warning says to check it).
 */
export function findingMessageKey(finding: Pick<Finding, "code" | "severity">): string {
  if ((KNOWN_FINDING_CODES as readonly string[]).includes(finding.code)) return finding.code;
  if (UNUSUAL_PATTERN.test(finding.code)) return "UNUSUAL_PATTERN";
  return finding.severity === "BLOCK" ? "GENERIC_BLOCK" : "GENERIC_WARN";
}

/**
 * Warnings for the dry-run block when the server cannot answer yet. Mirrors the BLOCK/WARN split of 02 §3.4: only
 * impossible input blocks; an unusual state for this animal is an amber WARN that still saves.
 */
export function clientFindings(key: EventKey, facts: AnimalFacts, date: string, today: string): Finding[] {
  const findings: Finding[] = [];
  if (date > today) findings.push({ code: "DATE_IN_FUTURE", severity: "BLOCK" });
  const def = EVENT_BY_KEY[key];
  if (def) {
    const result = eligibilityFor(def, facts, deriveChips(facts));
    if (result.status === "warn") findings.push({ code: "UNUSUAL_FOR_STATE", severity: "WARN", chips: result.chips });
  }
  return findings;
}
