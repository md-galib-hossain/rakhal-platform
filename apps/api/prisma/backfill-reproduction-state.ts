/**
 * One-off backfill for the `reproductive_status_redesign` migration
 * (RAKHAL-271, v2 correction). That migration deliberately does **not**
 * CASE-guess old `ReproductiveStatus` values into the new
 * `ReproductionState` column — a cow that was `DRY`/`LACTATING`/`HEIFER`
 * under the old enum is very often still pregnant or fertile, so a blind
 * value-to-value mapping would fabricate false fertility data. Every
 * existing `ReproductionProfile.reproductiveStatus` row lands `NULL`
 * ("not assessed") after that migration runs.
 *
 * This script re-derives the *real* state for every cow from her actual
 * `BreedingEvent`/`PregnancyDiagnosis` (via `Pregnancy`)/`CalvingEvent`/
 * `DryPeriod` history, using the exact same pure function
 * (`deriveReproductionState`) the live app calls on every write
 * (`ReproductionService.refreshProfile`) — not a guess, a real derivation
 * from event history. Rows where a cow record can no longer be resolved
 * (deleted/orphaned) are left `NULL` rather than guessed.
 *
 * Idempotent — safe to re-run; every row is recomputed from source events
 * each time, so a re-run after new data has been created just refreshes it.
 * Run via `pnpm ts-node -r tsconfig-paths/register prisma/backfill-reproduction-state.ts`.
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, PregnancyStatus } from '@prisma/client';
import {
  deriveReproductionState,
  ReproductionStateInput,
} from '../src/modules/reproduction/application/services/reproduction.service';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
});

const DEFAULT_VWP_DAYS = 60; // FarmModuleSettings.reproVwpDays default

async function vwpDaysForFarm(farmId: string): Promise<number> {
  const settings = await prisma.farmModuleSettings.findUnique({
    where: { farmId },
    select: { reproVwpDays: true },
  });
  return settings?.reproVwpDays ?? DEFAULT_VWP_DAYS;
}

async function main() {
  const profiles = await prisma.reproductionProfile.findMany({
    select: { id: true, cattleId: true },
  });
  console.log(
    `Found ${profiles.length} ReproductionProfile row(s) to backfill.`,
  );

  const now = new Date();
  const farmVwpCache = new Map<string, number>();

  let derived = 0;
  let leftNull = 0;

  for (const profile of profiles) {
    const cattle = await prisma.cattle.findUnique({
      where: { id: profile.cattleId },
      select: { id: true, farmId: true, gender: true, dateOfBirth: true },
    });

    if (!cattle) {
      // Orphaned profile (cow record gone) — genuinely ambiguous, leave NULL.
      leftNull += 1;
      continue;
    }

    if (!farmVwpCache.has(cattle.farmId)) {
      farmVwpCache.set(cattle.farmId, await vwpDaysForFarm(cattle.farmId));
    }
    const vwpDays = farmVwpCache.get(cattle.farmId)!;

    const [
      totalBreedings,
      pregnancies,
      totalCalvings,
      lastBreeding,
      lastCalving,
      currentPregnancy,
    ] = await Promise.all([
      prisma.breedingEvent.count({ where: { cattleId: cattle.id } }),
      prisma.pregnancy.findMany({
        where: { cattleId: cattle.id, status: { not: PregnancyStatus.FAILED } },
        select: { id: true, status: true },
      }),
      prisma.calvingEvent.count({ where: { cattleId: cattle.id } }),
      prisma.breedingEvent.findFirst({
        where: { cattleId: cattle.id },
        orderBy: { breedingDate: 'desc' },
        select: { status: true },
      }),
      prisma.calvingEvent.findFirst({
        where: { cattleId: cattle.id },
        orderBy: { calvingDate: 'desc' },
        select: { calvingDate: true },
      }),
      prisma.pregnancy.findFirst({
        where: { cattleId: cattle.id, status: PregnancyStatus.ACTIVE },
        orderBy: { conceptionDate: 'desc' },
        select: { id: true },
      }),
    ]);

    const input: ReproductionStateInput = {
      now,
      gender: cattle.gender,
      dateOfBirth: cattle.dateOfBirth,
      hasBreedingHistory:
        totalBreedings > 0 || pregnancies.length > 0 || totalCalvings > 0,
      hasActivePregnancy: Boolean(currentPregnancy),
      lastBreeding: lastBreeding ? { status: lastBreeding.status } : null,
      lastCalving: lastCalving
        ? { calvingDate: lastCalving.calvingDate }
        : null,
      vwpDays,
    };

    const state = deriveReproductionState(input);

    await prisma.reproductionProfile.update({
      where: { id: profile.id },
      data: { reproductiveStatus: state },
    });
    derived += 1;
  }

  console.log(
    `Backfill complete: ${derived} row(s) re-derived from real event history, ${leftNull} left NULL (orphaned cattle record).`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
