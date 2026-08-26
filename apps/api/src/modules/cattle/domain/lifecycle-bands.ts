/**
 * Pure lifecycle sub-stage derivation (RAKHAL-401, PRD §8.1 follow-up).
 * Sub-stages nest under the existing top-level `AnimalCategory`
 * (`animal-category.ts`) — HEIFER gains WEANED/GROWING/BREEDING bands, BULL
 * gains WEANER/GROWING/MATURE bands. COW and STEER have none. Declarative:
 * adding a stage is a row in `LIFECYCLE_BANDS`, not a redesign — the
 * derivation and its matching Prisma `where` builder are both generated from
 * this single table so they cannot drift apart (the failure mode
 * `buildAnimalCategoryWhere`'s own doc comment guards against by hand).
 *
 * Day boundaries are hardcoded defaults for this pass (mirrors the plan's
 * proposed values). Making them per-farm configurable via
 * `FarmModuleSettings` is a follow-up — deferred because that schema file
 * was under another agent's active claim at the time this was written.
 */

import { Prisma, CattleGender as PrismaCattleGender } from '@prisma/client';
import { ageInDays, DAY_MS } from 'src/modules/calf/domain/calf-stage';
import {
  AnimalCategory,
  AnimalCategoryGender,
  deriveAnimalCategory,
} from './animal-category';

export const LIFECYCLE_WEANING_DAYS = 60;
export const LIFECYCLE_GROWING_START_DAYS = 180;
export const LIFECYCLE_BREEDING_AGE_DAYS = 390;

interface LifecycleBand {
  subStage: string;
  category: AnimalCategory;
  minDays: number;
  maxDays: number | null;
}

/** Ordered youngest-band-first; the first band whose `[minDays, maxDays)`
 * contains the animal's age wins. A category with no matching band (COW,
 * STEER, or an animal younger than its category's first band — i.e. still a
 * CALF) derives `null`. */
export const LIFECYCLE_BANDS: readonly LifecycleBand[] = [
  {
    subStage: 'WEANED_HEIFER',
    category: 'HEIFER',
    minDays: LIFECYCLE_WEANING_DAYS,
    maxDays: LIFECYCLE_GROWING_START_DAYS,
  },
  {
    subStage: 'GROWING_HEIFER',
    category: 'HEIFER',
    minDays: LIFECYCLE_GROWING_START_DAYS,
    maxDays: LIFECYCLE_BREEDING_AGE_DAYS,
  },
  {
    subStage: 'BREEDING_HEIFER',
    category: 'HEIFER',
    minDays: LIFECYCLE_BREEDING_AGE_DAYS,
    maxDays: null,
  },
  {
    subStage: 'WEANER_BULL',
    category: 'BULL',
    minDays: LIFECYCLE_WEANING_DAYS,
    maxDays: LIFECYCLE_GROWING_START_DAYS,
  },
  {
    subStage: 'GROWING_BULL',
    category: 'BULL',
    minDays: LIFECYCLE_GROWING_START_DAYS,
    maxDays: LIFECYCLE_BREEDING_AGE_DAYS,
  },
  {
    subStage: 'MATURE_BULL',
    category: 'BULL',
    minDays: LIFECYCLE_BREEDING_AGE_DAYS,
    maxDays: null,
  },
];

export interface DeriveLifecycleSubStageInput {
  gender: AnimalCategoryGender;
  dateOfBirth: Date | null;
  totalCalvings: number;
  now?: Date;
}

/** Derive the read-only lifecycle sub-stage, or `null` if the animal's
 * top-level category has no bands (CALF/COW/STEER) or `dateOfBirth` is
 * unknown (age-gated, same fallthrough rule as `deriveAnimalCategory`). */
export function deriveLifecycleSubStage({
  gender,
  dateOfBirth,
  totalCalvings,
  now = new Date(),
}: DeriveLifecycleSubStageInput): string | null {
  if (!dateOfBirth) return null;

  const category = deriveAnimalCategory({
    gender,
    dateOfBirth,
    totalCalvings,
    now,
  });
  const ageDays = ageInDays(dateOfBirth, now);

  const band = LIFECYCLE_BANDS.find(
    (b) =>
      b.category === category &&
      ageDays >= b.minDays &&
      (b.maxDays === null || ageDays < b.maxDays),
  );
  return band?.subStage ?? null;
}

/** Prisma `where` fragment for a given lifecycle sub-stage — generated from
 * the same `LIFECYCLE_BANDS` table `deriveLifecycleSubStage` reads, so the
 * two cannot drift. Throws for an unknown sub-stage (a typo, not a valid
 * "no band" case — callers should validate against `LIFECYCLE_BANDS` first,
 * e.g. via a DTO enum). */
export function buildLifecycleSubStageWhere(
  subStage: string,
  now: Date,
): Prisma.CattleWhereInput {
  const band = LIFECYCLE_BANDS.find((b) => b.subStage === subStage);
  if (!band) {
    throw new Error(`Unknown lifecycle sub-stage: ${subStage}`);
  }

  const minDate = new Date(now.getTime() - band.minDays * DAY_MS);
  const dateOfBirth: Prisma.DateTimeNullableFilter = { lte: minDate };
  if (band.maxDays !== null) {
    dateOfBirth.gt = new Date(now.getTime() - band.maxDays * DAY_MS);
  }

  const genderFilter =
    band.category === 'HEIFER'
      ? PrismaCattleGender.FEMALE
      : PrismaCattleGender.MALE;

  const calvingFilter: Prisma.CattleWhereInput =
    band.category === 'HEIFER'
      ? {
          OR: [
            { reproductionProfile: null },
            { reproductionProfile: { totalCalvings: 0 } },
          ],
        }
      : {};

  return {
    AND: [{ gender: genderFilter }, { dateOfBirth }, calvingFilter],
  };
}
