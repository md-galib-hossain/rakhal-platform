/**
 * Add Animal Model: Pure helpers and data transforms for the Add Animal intake flow.
 * Includes category preview derivation, approximate date expansion, history preview items,
 * and API payload generation matching backend specifications.
 * Zero React/React Native dependencies so this runs under node --test.
 */

export type AnimalCategory = 'COW' | 'HEIFER' | 'CALF' | 'BULL' | 'STEER';
export type YesNo = 'yes' | 'no';
export type BreedingMethod = 'AI' | 'NATURAL' | 'EMBRYO_TRANSFER';

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

export type PreviewKind =
  | 'calving'
  | 'milking'
  | 'dry'
  | 'service'
  | 'pregnant'
  | 'vaccination'
  | 'reminderDryOff'
  | 'reminderPregCheck';

export interface PreviewItem {
  kind: PreviewKind;
  date: string | null;
  history: boolean;
}

export interface HistoryPayloadItem {
  kind: 'LAST_CALVING' | 'LAST_BREEDING' | 'PREGNANT' | 'MILKING_SINCE' | 'DRY_SINCE' | 'LAST_VACCINATION';
  date?: string;
  calvingNumber?: number;
  method?: BreedingMethod;
  bull?: string;
  expectedCalvingDate?: string;
  monthsPregnant?: number;
  product?: string;
}

const GESTATION_DAYS = 280;
const DRY_OFF_BEFORE_CALVING_DAYS = 60;
const PREG_CHECK_DAYS = 35;

export function isMonthOnly(date: string | undefined | null): boolean {
  return Boolean(date && /^\d{4}-\d{2}$/.test(date.trim()));
}

/** Expand approximate YYYY-MM date to middle of month (YYYY-MM-15) */
export function expandDate(date: string): string {
  const trimmed = date.trim();
  return isMonthOnly(trimmed) ? `${trimmed}-15` : trimmed;
}

/** Add calendar days to a YYYY-MM-DD date string */
export function addDaysIso(isoDate: string, days: number): string {
  const parts = isoDate.split('-').map(Number);
  const year = parts[0] ?? 2026;
  const month = parts[1] ?? 1;
  const day = parts[2] ?? 1;
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dt = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dt}`;
}

export function formatIsoToday(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

const filled = (value: string | undefined | null): value is string =>
  typeof value === 'string' && value.trim().length > 0;

/** Derive animal category preview based on gender and date of birth */
export function deriveCategoryPreview(
  gender: 'FEMALE' | 'MALE' | string,
  dobString?: string | null,
  calvedBefore?: boolean,
  now: Date = new Date(),
): AnimalCategory {
  if (dobString && filled(dobString)) {
    const expanded = expandDate(dobString);
    const dobParts = expanded.split('-').map(Number);
    const dobYear = dobParts[0] ?? 2026;
    const dobMonth = dobParts[1] ?? 1;
    const dobDay = dobParts[2] ?? 1;
    const dob = new Date(Date.UTC(dobYear, dobMonth - 1, dobDay));

    if (!Number.isNaN(dob.getTime())) {
      const nowUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
      const ageInDays = Math.floor((nowUtc - dob.getTime()) / (24 * 60 * 60 * 1000));
      if (ageInDays < 365) {
        return 'CALF';
      }
      if (gender === 'FEMALE') {
        if (calvedBefore || ageInDays >= 730) {
          return 'COW';
        }
        return 'HEIFER';
      }
      return 'BULL';
    }
  }

  if (gender === 'FEMALE') {
    return calvedBefore ? 'COW' : 'HEIFER';
  }
  return 'BULL';
}

function calvingDue(values: HistoryValues, today: string): string | null {
  if (values.pregnant !== 'yes') return null;
  if (filled(values.expectedCalvingDate)) return expandDate(values.expectedCalvingDate);
  if (typeof values.monthsPregnant === 'number' && values.monthsPregnant >= 0) {
    return addDaysIso(today, GESTATION_DAYS - Math.round(values.monthsPregnant * 30));
  }
  return null;
}

/** Check if history values will produce any event */
export function isEmptyHistory(values: HistoryValues, gender: string): boolean {
  return previewItems(values, gender, '2000-01-01').length === 0;
}

/** Compute list of preview items for "WE WILL SET UP" */
export function previewItems(values: HistoryValues, gender: string, today: string): PreviewItem[] {
  const items: PreviewItem[] = [];
  const female = gender === 'FEMALE';

  if (female) {
    if (values.calvedBefore === 'yes' && filled(values.lastCalvingDate)) {
      items.push({ kind: 'calving', date: expandDate(values.lastCalvingDate), history: true });
    }
    if (values.calvedBefore === 'yes' && values.milkingNow === 'yes' && filled(values.milkingSince)) {
      items.push({ kind: 'milking', date: expandDate(values.milkingSince), history: true });
    }
    if (values.calvedBefore === 'yes' && values.milkingNow === 'no' && filled(values.drySince)) {
      items.push({ kind: 'dry', date: expandDate(values.drySince), history: true });
    }
    if (filled(values.lastBreedingDate)) {
      items.push({ kind: 'service', date: expandDate(values.lastBreedingDate), history: true });
    }
    const due = calvingDue(values, today);
    if (values.pregnant === 'yes' && due) {
      items.push({ kind: 'pregnant', date: due, history: true });
      const dryOff = addDaysIso(due, -DRY_OFF_BEFORE_CALVING_DAYS);
      if (dryOff >= today) {
        items.push({ kind: 'reminderDryOff', date: dryOff, history: false });
      }
    } else if (values.pregnant !== 'yes' && filled(values.lastBreedingDate)) {
      const check = addDaysIso(expandDate(values.lastBreedingDate), PREG_CHECK_DAYS);
      if (check >= today) {
        items.push({ kind: 'reminderPregCheck', date: check, history: false });
      }
    }
  }

  if (filled(values.lastVaccinationDate)) {
    items.push({ kind: 'vaccination', date: expandDate(values.lastVaccinationDate), history: true });
  }

  return items;
}

const clean = (val?: string): string | undefined => (filled(val) ? val.trim() || undefined : undefined);

/** Convert user input into HistoryItemDto[] payload for API */
export function toHistoryPayload(
  values: HistoryValues,
  gender: string,
  today: string,
): HistoryPayloadItem[] | undefined {
  if (isEmptyHistory(values, gender)) return undefined;
  const history: HistoryPayloadItem[] = [];

  if (gender === 'FEMALE') {
    if (values.calvedBefore === 'yes' && filled(values.lastCalvingDate)) {
      history.push({
        kind: 'LAST_CALVING',
        date: expandDate(values.lastCalvingDate),
        ...(values.calvingNumber && values.calvingNumber >= 1
          ? { calvingNumber: Math.min(20, Math.round(values.calvingNumber)) }
          : {}),
      });
    }
    if (filled(values.lastBreedingDate)) {
      history.push({
        kind: 'LAST_BREEDING',
        date: expandDate(values.lastBreedingDate),
        method: values.breedingMethod ?? 'AI',
        ...(clean(values.bull) ? { bull: clean(values.bull) } : {}),
      });
    }
    if (values.pregnant === 'yes') {
      if (filled(values.expectedCalvingDate)) {
        history.push({
          kind: 'PREGNANT',
          expectedCalvingDate: expandDate(values.expectedCalvingDate),
        });
      } else if (typeof values.monthsPregnant === 'number') {
        history.push({
          kind: 'PREGNANT',
          monthsPregnant: Math.min(9, Math.max(1, Math.round(values.monthsPregnant))),
        });
      }
    }
    if (values.calvedBefore === 'yes' && values.milkingNow === 'yes' && filled(values.milkingSince)) {
      history.push({
        kind: 'MILKING_SINCE',
        date: expandDate(values.milkingSince),
      });
    }
    if (values.calvedBefore === 'yes' && values.milkingNow === 'no' && filled(values.drySince)) {
      history.push({
        kind: 'DRY_SINCE',
        date: expandDate(values.drySince),
      });
    }
  }

  if (filled(values.lastVaccinationDate)) {
    history.push({
      kind: 'LAST_VACCINATION',
      date: expandDate(values.lastVaccinationDate),
      ...(clean(values.vaccineProduct) ? { product: clean(values.vaccineProduct) } : {}),
    });
  }

  void today;
  return history;
}
