/**
 * Pure calf age-based care/vaccination schedule (PRD §14.5). No framework/Prisma
 * deps so it is trivially unit-testable; the service maps each item onto a Task
 * Hub task (category "Calf Care") with `dueAt = birthDate + offsetDays`.
 *
 * Female-only items (brucellosis) are filtered out for male calves. The offsets
 * are the configurable defaults from the PRD ("Month 1" ≈ 30d, "Month 3" ≈ 90d).
 */
import { CattleGender } from '@prisma/client';
import { DAY_MS } from './calf-stage';

export interface CalfCareScheduleItem {
  /** Stable key for the care event (useful for de-dup / config overrides). */
  key: string;
  name: string;
  details: string;
  /** Days after birth the reminder is due. */
  offsetDays: number;
  /** Computed due date = birthDate + offsetDays. */
  dueAt: Date;
}

interface CalfCareScheduleEntry {
  key: string;
  name: string;
  details: string;
  offsetDays: number;
  /** Only schedule this item for female calves. */
  femaleOnly?: boolean;
}

/** Default age-based schedule (PRD §14.5). Order is by ascending offset. */
export const CALF_CARE_SCHEDULE: ReadonlyArray<CalfCareScheduleEntry> = [
  {
    key: 'neonatal_care',
    name: 'Neonatal care',
    details:
      'Day 1 neonatal care: navel dipping, ensure colostrum intake, check vitals.',
    offsetDays: 1,
  },
  {
    key: 'first_deworming',
    name: 'First deworming',
    details: 'Day 7 first deworming for the calf.',
    offsetDays: 7,
  },
  {
    key: 'fmd_vaccination',
    name: 'First FMD vaccination',
    details: 'Day 14 first FMD (foot-and-mouth disease) vaccination.',
    offsetDays: 14,
  },
  {
    key: 'brucellosis_vaccination',
    name: 'Brucellosis vaccination',
    details: 'Day 21 brucellosis vaccination (female calves only).',
    offsetDays: 21,
    femaleOnly: true,
  },
  {
    key: 'one_month_checkup',
    name: 'One-month check-up',
    details: 'Month 1 routine check-up: weight, growth and health review.',
    offsetDays: 30,
  },
  {
    key: 'three_month_booster',
    name: 'Three-month booster',
    details: 'Month 3 booster vaccinations.',
    offsetDays: 90,
  },
];

/**
 * Build the dated care schedule for a calf. Female-only items are dropped for
 * male calves, so a female calf yields 6 items and a male calf yields 5.
 */
export function buildCalfCareSchedule(
  birthDate: Date,
  gender: CattleGender,
): CalfCareScheduleItem[] {
  return CALF_CARE_SCHEDULE.filter(
    (entry) => !entry.femaleOnly || gender === CattleGender.FEMALE,
  ).map((entry) => ({
    key: entry.key,
    name: entry.name,
    details: entry.details,
    offsetDays: entry.offsetDays,
    dueAt: new Date(birthDate.getTime() + entry.offsetDays * DAY_MS),
  }));
}
