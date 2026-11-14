/**
 * Pure lifecycle sub-stage derivation (RAKHAL-401, PRD §8.1 follow-up).
 * Sub-stages nest under the existing top-level `AnimalCategory`
 * (`animal-category.ts`) — HEIFER gains WEANED/GROWING/BREEDING bands, BULL
 * gains WEANER/GROWING/MATURE bands. COW and STEER have none. Declarative:
 * adding a stage is a row in `buildLifecycleBands()`, not a redesign — the
 * derivation and its matching Prisma `where` builder are both generated from
 * the same table so they cannot drift apart (the failure mode
 * `buildAnimalCategoryWhere`'s own doc comment guards against by hand).
 *
 * Day boundaries are now configurable per farm via three `FarmModuleSettings`
 * columns (`cattleLifecycleWeaningDays`/`GrowingStartDays`/`BreedingAgeDays`)
 * — callers that don't have a farm's settings loaded (create/update/archive/
 * restore/bulk-export, same set `composeStatus`'s `ReproductionContext` doc
 * comment already calls out) fall back to `DEFAULT_LIFECYCLE_BOUNDARIES`,
 * which reproduce this ticket's original hardcoded values exactly.
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

export interface LifecycleBoundaries {
  weaningDays: number;
  growingStartDays: number;
  breedingAgeDays: number;
}

export const DEFAULT_LIFECYCLE_BOUNDARIES: LifecycleBoundaries = {
  weaningDays: LIFECYCLE_WEANING_DAYS,
  growingStartDays: LIFECYCLE_GROWING_START_DAYS,
  breedingAgeDays: LIFECYCLE_BREEDING_AGE_DAYS,
};

interface LifecycleBand {
  subStage: string;
  category: AnimalCategory;
  minDays: number;
  maxDays: number | null;
}

/** The 6 sub-stage names, independent of the configured day boundaries — the
 * fixed enum a DTO validates a `lifecycleSubStage` filter against. */
export const LIFECYCLE_SUB_STAGES = [
  'WEANED_HEIFER',
  'GROWING_HEIFER',
  'BREEDING_HEIFER',
  'WEANER_BULL',
  'GROWING_BULL',
  'MATURE_BULL',
] as const;
export type LifecycleSubStage = (typeof LIFECYCLE_SUB_STAGES)[number];

/** Ordered youngest-band-first; the first band whose `[minDays, maxDays)`
 * contains the animal's age wins. A category with no matching band (COW,
 * STEER, or an animal younger than its category's first band — i.e. still a
 * CALF) derives `null`. */
function buildLifecycleBands(b: LifecycleBoundaries): readonly LifecycleBand[] {
  return [
    {
      subStage: 'WEANED_HEIFER',
      category: 'HEIFER',
      minDays: b.weaningDays,
      maxDays: b.growingStartDays,
    },
    {
      subStage: 'GROWING_HEIFER',
      category: 'HEIFER',
      minDays: b.growingStartDays,
      maxDays: b.breedingAgeDays,
    },
    {
      subStage: 'BREEDING_HEIFER',
      category: 'HEIFER',
      minDays: b.breedingAgeDays,
      maxDays: null,
    },
    {
      subStage: 'WEANER_BULL',
      category: 'BULL',
      minDays: b.weaningDays,
      maxDays: b.growingStartDays,
    },
    {
      subStage: 'GROWING_BULL',
      category: 'BULL',
      minDays: b.growingStartDays,
      maxDays: b.breedingAgeDays,
    },
    {
      subStage: 'MATURE_BULL',
      category: 'BULL',
      minDays: b.breedingAgeDays,
      maxDays: null,
    },
  ];
}

/** Bands built from the default boundaries — kept as a stable export since
 * existing tests/call sites reference the default table directly. */
export const LIFECYCLE_BANDS: readonly LifecycleBand[] = buildLifecycleBands(
  DEFAULT_LIFECYCLE_BOUNDARIES,
);

export interface DeriveLifecycleSubStageInput {
  gender: AnimalCategoryGender;
  dateOfBirth: Date | null;
  totalCalvings: number;
  now?: Date;
  /** Per-farm day boundaries (`FarmSettingsService.lifecycleBoundaries`) —
   * defaults to `DEFAULT_LIFECYCLE_BOUNDARIES` when the caller has no farm
   * settings loaded (same optional-enrichment precedent as `composeStatus`'s
   * `ReproductionContext`). */
  boundaries?: LifecycleBoundaries;
}

/** Derive the read-only lifecycle sub-stage, or `null` if the animal's
 * top-level category has no bands (CALF/COW/STEER) or `dateOfBirth` is
 * unknown (age-gated, same fallthrough rule as `deriveAnimalCategory`). */
export function deriveLifecycleSubStage({
  gender,
  dateOfBirth,
  totalCalvings,
  now = new Date(),
  boundaries = DEFAULT_LIFECYCLE_BOUNDARIES,
}: DeriveLifecycleSubStageInput): string | null {
  if (!dateOfBirth) return null;

  const category = deriveAnimalCategory({
    gender,
    dateOfBirth,
    totalCalvings,
    now,
  });
  const ageDays = ageInDays(dateOfBirth, now);

  const bands =
    boundaries === DEFAULT_LIFECYCLE_BOUNDARIES
      ? LIFECYCLE_BANDS
      : buildLifecycleBands(boundaries);

  const band = bands.find(
    (b) =>
      b.category === category &&
      ageDays >= b.minDays &&
      (b.maxDays === null || ageDays < b.maxDays),
  );
  return band?.subStage ?? null;
}

/** Prisma `where` fragment for a given lifecycle sub-stage — generated from
 * the same bands table `deriveLifecycleSubStage` reads, so the two cannot
 * drift. Throws for an unknown sub-stage (a typo, not a valid "no band" case
 * — callers should validate against `LIFECYCLE_SUB_STAGES` first, e.g. via a
 * DTO enum). */
export function buildLifecycleSubStageWhere(
  subStage: string,
  now: Date,
  boundaries: LifecycleBoundaries = DEFAULT_LIFECYCLE_BOUNDARIES,
): Prisma.CattleWhereInput {
  const bands =
    boundaries === DEFAULT_LIFECYCLE_BOUNDARIES
      ? LIFECYCLE_BANDS
      : buildLifecycleBands(boundaries);
  const band = bands.find((b) => b.subStage === subStage);
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
