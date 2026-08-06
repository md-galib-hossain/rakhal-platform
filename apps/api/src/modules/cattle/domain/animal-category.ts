/**
 * Pure animal-category derivation (RAKHAL-270, PRD §8.1 read model). Never
 * stored — computed on read from age, gender, and calving history — so it
 * has no framework/Prisma dependency and is trivially unit-testable.
 */

import { Prisma, CattleGender as PrismaCattleGender } from '@prisma/client';
import {
  ageInDays,
  DAY_MS,
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

/** Prisma `where` fragment for a given `AnimalCategory` (RAKHAL-289, PRD
 * §8.1) — `animalCategory` is never stored, so this mirrors
 * `deriveAnimalCategory()` above exactly rather than reading a column. Pure
 * (`now` + Prisma enum values only, no service/Prisma-client state), so it is
 * reusable from any module (e.g. `CattleService.findAll()`'s list filter and
 * `DashboardService.herdStatus()`'s `categoryBreakdown` counts) without a
 * cross-module DI dependency. CALF is age-only (any gender, `dateOfBirth`
 * above the weaning cutoff — a missing `dateOfBirth` never matches CALF, same
 * as `deriveAnimalCategory()`'s fallthrough). The other 4 categories gate on
 * gender + "not a calf by age" (a missing `dateOfBirth` passes this gate,
 * same fallthrough) + calving count via the nullable `reproductionProfile`
 * relation — a heifer with zero reproduction history has **no** profile row
 * at all (not `totalCalvings: 0`), which is exactly bug RAKHAL-289 was filed
 * over, so HEIFER matches `reproductionProfile: null` OR `totalCalvings: 0`. */
export function buildAnimalCategoryWhere(
  category: AnimalCategory,
  now: Date,
): Prisma.CattleWhereInput {
  const weaningCutoff = new Date(now.getTime() - DEFAULT_WEANING_DAYS * DAY_MS);
  const notCalfByAge: Prisma.CattleWhereInput = {
    OR: [{ dateOfBirth: null }, { dateOfBirth: { lt: weaningCutoff } }],
  };

  switch (category) {
    case 'CALF':
      return { dateOfBirth: { gte: weaningCutoff } };
    case 'HEIFER':
      return {
        AND: [
          { gender: PrismaCattleGender.FEMALE },
          notCalfByAge,
          {
            OR: [
              { reproductionProfile: null },
              { reproductionProfile: { totalCalvings: 0 } },
            ],
          },
        ],
      };
    case 'COW':
      return {
        AND: [
          { gender: PrismaCattleGender.FEMALE },
          notCalfByAge,
          { reproductionProfile: { totalCalvings: { gt: 0 } } },
        ],
      };
    case 'BULL':
      return {
        AND: [{ gender: PrismaCattleGender.MALE }, notCalfByAge],
      };
    case 'STEER':
      return {
        AND: [{ gender: PrismaCattleGender.CASTRATED_MALE }, notCalfByAge],
      };
  }
}
