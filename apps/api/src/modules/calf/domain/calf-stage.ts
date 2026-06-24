/**
 * Pure calf-rearing domain helpers (PRD §14). No framework/Prisma deps so they
 * are trivially unit-testable. Age stages, ADG (average daily gain), and the
 * weaning target date live here; the service composes them over persisted rows.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/** Default weaning age in days (PRD §14.4 — "birth date + 60 days", configurable). */
export const DEFAULT_WEANING_DAYS = 60;

/** Age-based feeding/management stage (PRD §14.2). */
export type CalfStage = 'newborn' | 'young' | 'pre_weaning' | 'post_weaning';

/** Whole days between birth and `now` (never negative). */
export function ageInDays(dateOfBirth: Date, now: Date = new Date()): number {
  return Math.max(
    0,
    Math.floor((now.getTime() - dateOfBirth.getTime()) / DAY_MS),
  );
}

/** Map an age in days to its stage (newborn 0–7, young 7–60, pre-weaning 60–90, post-weaning >90). */
export function stageForAge(ageDays: number): CalfStage {
  if (ageDays < 7) return 'newborn';
  if (ageDays < 60) return 'young';
  if (ageDays < 90) return 'pre_weaning';
  return 'post_weaning';
}

/**
 * Date-of-birth bounds that select a stage at `now`, for DB filtering.
 * Older animals have an earlier DOB, so the bounds invert the age window.
 */
export function stageDobRange(
  stage: CalfStage,
  now: Date = new Date(),
): { gte?: Date; lt?: Date } {
  const at = (days: number) => new Date(now.getTime() - days * DAY_MS);
  switch (stage) {
    case 'newborn':
      return { gte: at(7) };
    case 'young':
      return { gte: at(60), lt: at(7) };
    case 'pre_weaning':
      return { gte: at(90), lt: at(60) };
    case 'post_weaning':
      return { lt: at(90) };
  }
}

/** Average daily gain in kg/day, or null when it can't be computed. */
export function computeAdg(
  birthWeightKg: number | null,
  currentWeightKg: number | null,
  ageDays: number,
): number | null {
  if (birthWeightKg == null || currentWeightKg == null || ageDays <= 0) {
    return null;
  }
  return Math.round(((currentWeightKg - birthWeightKg) / ageDays) * 100) / 100;
}

/** Target weaning date = birth date + `days` (PRD §14.4). */
export function weaningTargetDate(
  dateOfBirth: Date,
  days: number = DEFAULT_WEANING_DAYS,
): Date {
  return new Date(dateOfBirth.getTime() + days * DAY_MS);
}
