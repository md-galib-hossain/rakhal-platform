import { addDaysLocalIso } from "@/lib/local-date";
import type { HistoryPayload } from "../../types";

/**
 * RFE-162 — the "Her / His history" step of Add animal (03 §6, 04 §5 walkthrough A). The step collects what the farmer
 * knows about an animal that was not born here; each answer becomes a backdated HISTORICAL event on the server, so the
 * animal starts with the right state (Pregnant chip, calving due) without an AI on file.
 */

export type YesNo = "yes" | "no";
export type BreedingMethod = "AI" | "NATURAL" | "EMBRYO_TRANSFER";

/** Dates are `YYYY-MM-DD`, or `YYYY-MM` when the farmer only knows the month ("approximate date"). */
export interface HistoryValues {
  calvedBefore?: YesNo;
  lastCalvingDate?: string;
  calvingNumber?: number;
  milkingNow?: YesNo;
  milkingSince?: string;
  drySince?: string;
  pregnant?: YesNo;
  expectedCalvingDate?: string;
  monthsPregnant?: number;
  lastBreedingDate?: string;
  breedingMethod?: BreedingMethod;
  bull?: string;
  lastVaccinationDate?: string;
  vaccineProduct?: string;
}

const GESTATION_DAYS = 280;
const DRY_OFF_BEFORE_CALVING_DAYS = 60;
const PREG_CHECK_DAYS = 35;

export function isMonthOnly(date: string | undefined): boolean {
  return Boolean(date) && /^\d{4}-\d{2}$/.test(date as string);
}

/** A month-only answer is stored as the middle of that month, so any later day arithmetic is off by at most ~2 weeks. */
export function expandDate(date: string): string {
  return isMonthOnly(date) ? `${date}-15` : date;
}

const filled = (value: string | undefined): value is string => typeof value === "string" && value.length > 0;

function calvingDue(values: HistoryValues, today: string): string | null {
  if (values.pregnant !== "yes") return null;
  if (filled(values.expectedCalvingDate)) return expandDate(values.expectedCalvingDate);
  if (typeof values.monthsPregnant === "number" && values.monthsPregnant >= 0) {
    return addDaysLocalIso(today, GESTATION_DAYS - Math.round(values.monthsPregnant * 30));
  }
  return null;
}

/** True when the farmer answered nothing that would create an event ("Skip" and an empty step both create nothing). */
export function isEmptyHistory(values: HistoryValues, gender: string): boolean {
  return previewItems(values, gender, "2000-01-01").length === 0;
}

// ---- Preview ("We will set up") --------------------------------------------------------------------------------

export type PreviewKind = "calving" | "milking" | "dry" | "service" | "pregnant" | "vaccination" | "reminderDryOff" | "reminderPregCheck";

export interface PreviewItem {
  kind: PreviewKind;
  /** `YYYY-MM-DD` (month-only answers already expanded). */
  date: string | null;
  /** Recorded after the fact (tagged "history"), as opposed to a reminder that is still to come. */
  history: boolean;
}

/**
 * What saving will create: backdated events tagged history, plus the reminders that are still ahead. A reminder whose
 * day has already passed is not listed (04 §5.A: nothing is created for past dates).
 */
export function previewItems(values: HistoryValues, gender: string, today: string): PreviewItem[] {
  const items: PreviewItem[] = [];
  const female = gender === "FEMALE";
  if (female) {
    if (values.calvedBefore === "yes" && filled(values.lastCalvingDate)) items.push({ kind: "calving", date: expandDate(values.lastCalvingDate), history: true });
    if (values.calvedBefore === "yes" && values.milkingNow === "yes" && filled(values.milkingSince)) items.push({ kind: "milking", date: expandDate(values.milkingSince), history: true });
    if (values.calvedBefore === "yes" && values.milkingNow === "no" && filled(values.drySince)) items.push({ kind: "dry", date: expandDate(values.drySince), history: true });
    if (filled(values.lastBreedingDate)) items.push({ kind: "service", date: expandDate(values.lastBreedingDate), history: true });
    const due = calvingDue(values, today);
    if (values.pregnant === "yes" && due) {
      items.push({ kind: "pregnant", date: due, history: true });
      const dryOff = addDaysLocalIso(due, -DRY_OFF_BEFORE_CALVING_DAYS);
      if (dryOff >= today) items.push({ kind: "reminderDryOff", date: dryOff, history: false });
    } else if (values.pregnant !== "yes" && filled(values.lastBreedingDate)) {
      const check = addDaysLocalIso(expandDate(values.lastBreedingDate), PREG_CHECK_DAYS);
      if (check >= today) items.push({ kind: "reminderPregCheck", date: check, history: false });
    }
  }
  if (filled(values.lastVaccinationDate)) items.push({ kind: "vaccination", date: expandDate(values.lastVaccinationDate), history: true });
  return items;
}

// ---- Payloads ---------------------------------------------------------------------------------------------------

const clean = (value: string | undefined): string | undefined => (filled(value) ? value.trim() || undefined : undefined);

/** The `history` array `POST /cattle` takes: one `{kind, ...}` item per answer (`HistoryItemDto`, backend `intake.dto.ts`). */
export function toHistoryPayload(values: HistoryValues, gender: string, today: string): HistoryPayload | undefined {
  if (isEmptyHistory(values, gender)) return undefined;
  const history: HistoryPayload = [];
  if (gender === "FEMALE") {
    if (values.calvedBefore === "yes" && filled(values.lastCalvingDate)) {
      history.push({
        kind: "LAST_CALVING",
        date: expandDate(values.lastCalvingDate),
        ...(values.calvingNumber && values.calvingNumber >= 1 ? { calvingNumber: Math.min(20, Math.round(values.calvingNumber)) } : {}),
      });
    }
    if (filled(values.lastBreedingDate)) {
      history.push({
        kind: "LAST_BREEDING",
        date: expandDate(values.lastBreedingDate),
        method: values.breedingMethod ?? "AI",
        ...(clean(values.bull) ? { bull: clean(values.bull) } : {}),
      });
    }
    if (values.pregnant === "yes") {
      if (filled(values.expectedCalvingDate)) history.push({ kind: "PREGNANT", expectedCalvingDate: expandDate(values.expectedCalvingDate) });
      // The server takes whole months, 1 to 9.
      else if (typeof values.monthsPregnant === "number") history.push({ kind: "PREGNANT", monthsPregnant: Math.min(9, Math.max(1, Math.round(values.monthsPregnant))) });
    }
    if (values.calvedBefore === "yes" && values.milkingNow === "yes" && filled(values.milkingSince)) history.push({ kind: "MILKING_SINCE", date: expandDate(values.milkingSince) });
    if (values.calvedBefore === "yes" && values.milkingNow === "no" && filled(values.drySince)) history.push({ kind: "DRY_SINCE", date: expandDate(values.drySince) });
  }
  if (filled(values.lastVaccinationDate)) {
    history.push({
      kind: "LAST_VACCINATION",
      date: expandDate(values.lastVaccinationDate),
      ...(clean(values.vaccineProduct) ? { product: clean(values.vaccineProduct) } : {}),
    });
  }
  void today;
  return history;
}
