/**
 * Pure animal-category derivation (RAKHAL-270, PRD §8.1 read model). Never
 * stored — computed on read from age, gender, and calving history — so it
 * has no framework/Prisma dependency and is trivially unit-testable.
 */

import {
  ageInDays,
  DEFAULT_WEANING_DAYS,
} from 'src/modules/calf/domain/calf-stage';

/** Mirrors `CattleGender` (`prisma/schemas/cattle/cattle.enums.prisma`) without a Prisma dependency. */
export type AnimalCategoryGender = 'MALE' | 'FEMALE' | 'CASTRATED_MALE';

export const ANIMAL_CATEGORIES = [
  'CALF',
  'HEIFER',
  'COW',
  'BULL',
  'STEER',
] as const;
export type AnimalCategory = (typeof ANIMAL_CATEGORIES)[number];

export interface DeriveAnimalCategoryInput {
  gender: AnimalCategoryGender;
  dateOfBirth: Date | null;
  totalCalvings: number;
  now?: Date;
}

/**
 * Derive the read-only `AnimalCategory` (PRD §8.1). Age below the weaning
 * threshold always wins (CALF), regardless of gender or calving history —
 * reuses the calf module's own `DEFAULT_WEANING_DAYS`/`ageInDays`
 * (`src/modules/calf/domain/calf-stage.ts`) so the CALF cutoff never drifts
 * from the calf module's weaning target date. A missing `dateOfBirth` skips
 * the CALF check (age unknown) and falls through to gender/calving rules.
 * Above the threshold: female with no calvings → HEIFER, female with 1+ →
 * COW, male → BULL, castrated male → STEER.
 */
export function deriveAnimalCategory({
  gender,
  dateOfBirth,
  totalCalvings,
  now = new Date(),
}: DeriveAnimalCategoryInput): AnimalCategory {
  if (dateOfBirth && ageInDays(dateOfBirth, now) < DEFAULT_WEANING_DAYS) {
    return 'CALF';
  }

  switch (gender) {
    case 'FEMALE':
      return totalCalvings > 0 ? 'COW' : 'HEIFER';
    case 'MALE':
      return 'BULL';
    case 'CASTRATED_MALE':
      return 'STEER';
  }
}
