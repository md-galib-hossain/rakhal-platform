import { Injectable } from '@nestjs/common';
import {
  BreedingStatus,
  CattleGender,
  LactationStatus,
  PregnancyDiagnosisResult,
  PregnancyStatus,
  ProductionStatus,
  ReproductionState,
} from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { deriveBreedingStatus } from '../../domain/breeding-status';
import { computeDryOffProjection } from '../../domain/lactation-dry-off-projection';

/** ~15 months — typical heifer breeding-readiness threshold (PRD §9). Moved
 * here from `reproduction.service.ts` (RAKHAL-301) — only `deriveReproductionState` uses it. */
const MIN_BREEDING_AGE_DAYS = 450;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface ReproductionStateInput {
  now: Date;
  gender: CattleGender | null | undefined;
  dateOfBirth: Date | null;
  /** Ever bred/pregnant/calved — guards NOT_ELIGIBLE from overriding real history. */
  hasBreedingHistory: boolean;
  hasActivePregnancy: boolean;
  lastBreeding: { status: BreedingStatus } | null;
  lastCalving: { calvingDate: Date } | null;
  vwpDays: number;
}

/**
 * Pure breeding-cycle CORE-STATE derivation (RAKHAL-271, v2 correction).
 * Priority (first match wins): NOT_ELIGIBLE (male / under breeding age with
 * no history) → PREGNANT (any active pregnancy, regardless of closeness to
 * calving — that's the derived `CALVING_DUE` alert's job, not a different
 * state) → BRED_AWAITING_CONFIRMATION (pending-check breeding) →
 * POSTPARTUM_WAITING (inside VWP after last calving) → OPEN.
 *
 * Moved from `ReproductionService` to `ReproductionDerivationService`
 * (RAKHAL-301) — re-exported from `reproduction.service.ts` so existing
 * import paths (incl. its own unit test suite) don't churn.
 */
export function deriveReproductionState(
  input: ReproductionStateInput,
): ReproductionState {
  const {
    now,
    gender,
    dateOfBirth,
    hasBreedingHistory,
    hasActivePregnancy,
    lastBreeding,
    lastCalving,
    vwpDays,
  } = input;

  const ageDays = dateOfBirth
    ? Math.floor((now.getTime() - dateOfBirth.getTime()) / DAY_MS)
    : null;
  const underBreedingAge = ageDays !== null && ageDays < MIN_BREEDING_AGE_DAYS;

  if (
    gender !== CattleGender.FEMALE ||
    (underBreedingAge && !hasBreedingHistory)
  ) {
    return ReproductionState.NOT_ELIGIBLE;
  }

  if (hasActivePregnancy) {
    return ReproductionState.PREGNANT;
  }

  if (lastBreeding?.status === BreedingStatus.PENDING_CHECK) {
    return ReproductionState.BRED_AWAITING_CONFIRMATION;
  }

  if (lastCalving) {
    const daysSinceCalving = Math.floor(
      (now.getTime() - lastCalving.calvingDate.getTime()) / DAY_MS,
    );
    if (daysSinceCalving < vwpDays) {
      return ReproductionState.POSTPARTUM_WAITING;
    }
  }

  return ReproductionState.OPEN;
}

/**
 * RAKHAL-301: single recompute entry point for every reproduction-adjacent
 * piece of *derived* state, superseding `ReproductionService`'s old private
 * `refreshProfile()` (which only covered `ReproductionProfile`). Called after
 * every write in `ReproductionService` — same "update the row → recompute
 * everything downstream" shape `refreshProfile` already established, just
 * widened to the four stored flips that used to be imperative, one-off
 * `update()` calls scattered across create paths:
 * `BreedingEvent.status`, `Pregnancy.status`, `Cattle.productionStatus`,
 * `Lactation.recommendedDryOffAt`. Making them derived is what lets a future
 * edit handler (RAKHAL-305) be "update the row → recompute" instead of a
 * bespoke restore path per field.
 *
 * Every step here is idempotent by construction — each recompute reads live
 * state and writes only when the derived value differs from what's stored
 * (skips writes on a no-op recompute, which also avoids needlessly bumping
 * `@updatedAt` columns on unrelated repeat calls).
 */
@Injectable()
export class ReproductionDerivationService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly farmSettings: FarmSettingsService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(ReproductionDerivationService.name);
  }

  async refreshDerivedState(farmId: string, cattleId: string): Promise<void> {
    // Order matters: Pregnancy.status must be current before BreedingEvent
    // status (its facts read Pregnancy.status) and before the Lactation
    // dry-off projection (reads the live active Pregnancy). The
    // ReproductionProfile refresh runs last so it observes everything else
    // already settled in this same call.
    await this.refreshPregnancyStatuses(cattleId);
    await this.refreshBreedingEventStatuses(cattleId);
    await this.refreshCattleProductionStatus(cattleId);
    await this.refreshLactationDryOffProjection(farmId, cattleId);
    await this.refreshReproductionProfile(farmId, cattleId);
  }

  /**
   * `Pregnancy.status` from live downstream facts: a linked `CalvingEvent` →
   * `CALVED`, a linked `AbortionEvent` → `ABORTED`. `FAILED` has no positive
   * fact to derive from yet (RAKHAL-305's diagnosis-edit reversal will be the
   * only writer) — preserved as-is rather than guessed back to `ACTIVE`.
   */
  private async refreshPregnancyStatuses(cattleId: string): Promise<void> {
    const pregnancies = await this.prisma.pregnancy.findMany({
      where: { cattleId },
      select: { id: true, status: true },
    });
    if (pregnancies.length === 0) return;

    const pregnancyIds = pregnancies.map((p) => p.id);
    const [calvings, abortions] = await Promise.all([
      this.prisma.calvingEvent.findMany({
        where: { pregnancyId: { in: pregnancyIds } },
        select: { pregnancyId: true },
      }),
      this.prisma.abortionEvent.findMany({
        where: { pregnancyId: { in: pregnancyIds } },
        select: { pregnancyId: true },
      }),
    ]);
    const calvedIds = new Set(calvings.map((c) => c.pregnancyId));
    const abortedIds = new Set(abortions.map((a) => a.pregnancyId));

    await Promise.all(
      pregnancies.map((pregnancy) => {
        // RAKHAL-325: CANCELLED_CORRECTION is a terminal, explicitly-written
        // status (only `ReproductionService.correctPregnancy` writes it) —
        // preserved here the same way FAILED already is, never guessed back
        // to ACTIVE by this recompute.
        const next = calvedIds.has(pregnancy.id)
          ? PregnancyStatus.CALVED
          : abortedIds.has(pregnancy.id)
            ? PregnancyStatus.ABORTED
            : pregnancy.status === PregnancyStatus.FAILED
              ? PregnancyStatus.FAILED
              : pregnancy.status === PregnancyStatus.CANCELLED_CORRECTION
                ? PregnancyStatus.CANCELLED_CORRECTION
                : PregnancyStatus.ACTIVE;

        if (next === pregnancy.status) return Promise.resolve();
        return this.prisma.pregnancy.update({
          where: { id: pregnancy.id },
          data: { status: next },
        });
      }),
    );
  }

  /**
   * `BreedingEvent.status` via the pure `deriveBreedingStatus` (RAKHAL-299).
   * Facts are read from `Pregnancy.status` (already refreshed above, not
   * re-derived here) and any `NOT_PREGNANT` diagnosis recorded against the
   * event.
   */
  private async refreshBreedingEventStatuses(cattleId: string): Promise<void> {
    const events = await this.prisma.breedingEvent.findMany({
      where: { cattleId },
      select: { id: true, status: true },
    });
    if (events.length === 0) return;

    const eventIds = events.map((e) => e.id);
    const [pregnancies, failedDiagnoses, returnedToHeatEvents] =
      await Promise.all([
        this.prisma.pregnancy.findMany({
          where: { breedingEventId: { in: eventIds } },
          select: { breedingEventId: true, status: true },
        }),
        this.prisma.pregnancyDiagnosis.findMany({
          where: {
            breedingEventId: { in: eventIds },
            result: PregnancyDiagnosisResult.NOT_PREGNANT,
          },
          select: { breedingEventId: true },
        }),
        // RAKHAL-316: a HeatEvent pointing back at this breeding means the
        // farmer confirmed a return to heat — no diagnosis was performed.
        this.prisma.heatEvent.findMany({
          where: { returnedFromBreedingEventId: { in: eventIds } },
          select: { returnedFromBreedingEventId: true },
        }),
      ]);

    const statusesByEvent = new Map<string, PregnancyStatus[]>();
    for (const pregnancy of pregnancies) {
      if (!pregnancy.breedingEventId) continue;
      const list = statusesByEvent.get(pregnancy.breedingEventId) ?? [];
      list.push(pregnancy.status);
      statusesByEvent.set(pregnancy.breedingEventId, list);
    }
    const failedDiagnosisEventIds = new Set(
      failedDiagnoses
        .map((d) => d.breedingEventId)
        .filter((id): id is string => id !== null),
    );
    const returnedToHeatEventIds = new Set(
      returnedToHeatEvents
        .map((h) => h.returnedFromBreedingEventId)
        .filter((id): id is string => id !== null),
    );

    await Promise.all(
      events.map((event) => {
        const statuses = statusesByEvent.get(event.id) ?? [];
        const next = deriveBreedingStatus({
          hasCalving: statuses.includes(PregnancyStatus.CALVED),
          hasAbortion: statuses.includes(PregnancyStatus.ABORTED),
          hasActivePregnancy: statuses.includes(PregnancyStatus.ACTIVE),
          hasFailedDiagnosis: failedDiagnosisEventIds.has(event.id),
          hasReturnedToHeat: returnedToHeatEventIds.has(event.id),
        });

        if (next === event.status) return Promise.resolve();
        return this.prisma.breedingEvent.update({
          where: { id: event.id },
          data: { status: next },
        });
      }),
    );
  }

  /**
   * `Cattle.productionStatus` from live lactation/dry-period state: an open
   * `DryPeriod` → `DRY`, an `ACTIVE` `Lactation` → `MILKING` (the two are
   * mutually exclusive by construction — `recordDryOff` always ends the
   * active lactation before opening a dry period). **Neither → leave as-is**:
   * a fresh heifer/calf with no lactation/dry-period fact yet must not be
   * silently nulled by a recompute that found nothing either way.
   *
   * RD-048 (2026-09-17): this is now the field's *only* writer —
   * `CattleService.create()`/`update()`/`updateStatus()` no longer write
   * `productionStatus` directly; each requires + creates the backing
   * Lactation/DryPeriod fact first (mirroring `updateStatus()`'s pre-existing
   * MILKING guard, now applied symmetrically to DRY and to the general edit
   * path too), then calls `refreshDerivedState` to let this method persist
   * the value. Two writers disagreeing (the bug RD-048 described) can no
   * longer happen — every stored value is always backed by a real fact.
   */
  private async refreshCattleProductionStatus(cattleId: string): Promise<void> {
    const [cattle, openDryPeriod, activeLactation] = await Promise.all([
      this.prisma.cattle.findUnique({
        where: { id: cattleId },
        select: { productionStatus: true, herdStatus: true, deletedAt: true },
      }),
      this.prisma.dryPeriod.findFirst({
        where: { cattleId, actualEndDate: null },
        select: { id: true },
      }),
      this.prisma.lactation.findFirst({
        where: { cattleId, status: LactationStatus.ACTIVE },
        select: { id: true },
      }),
    ]);
    if (!cattle || cattle.herdStatus !== 'ACTIVE' || cattle.deletedAt) return;

    const next = openDryPeriod
      ? ProductionStatus.DRY
      : activeLactation
        ? ProductionStatus.MILKING
        : null;
    if (!next || next === cattle.productionStatus) return;

    await this.prisma.cattle.updateMany({
      where: { id: cattleId, herdStatus: 'ACTIVE', deletedAt: null },
      data: { productionStatus: next },
    });
  }

  /**
   * `Lactation.recommendedDryOffAt` (RAKHAL-285) via the existing pure
   * `computeDryOffProjection` — never reimplemented here. Pregnant branch
   * only: mirrors `createPregnancyDiagnosis`'s recompute (set from the live
   * active `Pregnancy.expectedCalvingDate`) and `createAbortionEvent`'s clear
   * (null when not pregnant) — both collapse into one derivation.
   */
  private async refreshLactationDryOffProjection(
    farmId: string,
    cattleId: string,
  ): Promise<void> {
    const activeLactation = await this.prisma.lactation.findFirst({
      where: { cattleId, status: LactationStatus.ACTIVE },
      select: { id: true, recommendedDryOffAt: true },
    });
    if (!activeLactation) return;

    const activePregnancy = await this.prisma.pregnancy.findFirst({
      where: { cattleId, status: PregnancyStatus.ACTIVE },
      orderBy: { conceptionDate: 'desc' },
      select: { expectedCalvingDate: true },
    });

    let recommendedDryOffAt: Date | null = null;
    if (activePregnancy?.expectedCalvingDate) {
      const dryPeriodDays =
        await this.farmSettings.reproDryPeriodTargetDays(farmId);
      recommendedDryOffAt = computeDryOffProjection({
        isPregnant: true,
        expectedCalvingDate: activePregnancy.expectedCalvingDate,
        dryPeriodDays,
      }).recommendedDryOffAt;
    }

    const currentTime = activeLactation.recommendedDryOffAt?.getTime() ?? null;
    const nextTime = recommendedDryOffAt?.getTime() ?? null;
    if (currentTime === nextTime) return;

    await this.prisma.lactation.update({
      where: { id: activeLactation.id },
      data: { recommendedDryOffAt },
    });
  }

  /**
   * Recomputes `ReproductionProfile` from live event state (RAKHAL-271).
   * Moved verbatim from `ReproductionService.refreshProfile` (RAKHAL-301) —
   * `farmId` is needed to read the farm's VWP setting (`FarmSettingsService`,
   * RD-016 pattern).
   */
  private async refreshReproductionProfile(
    farmId: string,
    cattleId: string,
  ): Promise<void> {
    const [
      cattle,
      vwpDays,
      totalBreedings,
      pregnancies,
      realCalvingCount,
      totalAbortions,
      firstCalving,
      lastBreeding,
      lastDiagnosis,
      lastCalving,
      currentPregnancy,
      currentLactation,
      existingProfile,
    ] = await Promise.all([
      this.prisma.cattle.findUnique({
        where: { id: cattleId },
        select: { gender: true, dateOfBirth: true },
      }),
      this.farmSettings.reproVwpDays(farmId),
      this.prisma.breedingEvent.count({ where: { cattleId } }),
      // RAKHAL-325: totalPregnancies feeds farm-level KPIs/reports —
      // CANCELLED_CORRECTION (a data-entry mistake, not a real pregnancy)
      // must not inflate it, same reasoning FAILED's existing exclusion
      // already applies.
      this.prisma.pregnancy.findMany({
        where: {
          cattleId,
          status: {
            notIn: [
              PregnancyStatus.FAILED,
              PregnancyStatus.CANCELLED_CORRECTION,
            ],
          },
        },
        select: { id: true, status: true },
      }),
      this.prisma.calvingEvent.count({ where: { cattleId } }),
      this.prisma.abortionEvent.count({ where: { cattleId } }),
      this.prisma.calvingEvent.findFirst({
        where: { cattleId },
        orderBy: { calvingDate: 'asc' },
      }),
      this.prisma.breedingEvent.findFirst({
        where: { cattleId },
        orderBy: { breedingDate: 'desc' },
      }),
      this.prisma.pregnancyDiagnosis.findFirst({
        where: { cattleId },
        orderBy: { diagnosisDate: 'desc' },
      }),
      this.prisma.calvingEvent.findFirst({
        where: { cattleId },
        orderBy: { calvingDate: 'desc' },
      }),
      this.prisma.pregnancy.findFirst({
        where: { cattleId, status: PregnancyStatus.ACTIVE },
        orderBy: { conceptionDate: 'desc' },
      }),
      this.prisma.lactation.findFirst({
        where: { cattleId, status: LactationStatus.ACTIVE },
        orderBy: { startDate: 'desc' },
      }),
      // RD-055: a purchase-intake `priorCalvings`/`prior_calvings` seeds this
      // profile's `totalCalvings` with real prior history that has no
      // `CalvingEvent` row backing it (the calving happened before the cow
      // was in this system) — `realCalvingCount` alone would silently reset
      // that seed back to 0 the moment this recompute runs post-commit.
      // Reading the existing value here lets `totalCalvings` below take
      // whichever is larger, so an intake seed is never lost.
      this.prisma.reproductionProfile.findUnique({
        where: { cattleId },
        select: { totalCalvings: true },
      }),
    ]);

    // A real CalvingEvent recorded in this system is always at least as
    // trustworthy as an intake estimate, so it can only raise the count,
    // never lower it below whatever was already on the profile (intake
    // seed, or a prior recompute).
    const totalCalvings = Math.max(
      realCalvingCount,
      existingProfile?.totalCalvings ?? 0,
    );

    const status = deriveReproductionState({
      now: new Date(),
      gender: cattle?.gender,
      dateOfBirth: cattle?.dateOfBirth ?? null,
      hasBreedingHistory:
        totalBreedings > 0 || pregnancies.length > 0 || totalCalvings > 0,
      hasActivePregnancy: Boolean(currentPregnancy),
      lastBreeding: lastBreeding ? { status: lastBreeding.status } : null,
      lastCalving: lastCalving
        ? { calvingDate: lastCalving.calvingDate }
        : null,
      vwpDays,
    });

    await this.prisma.reproductionProfile.upsert({
      where: { cattleId },
      create: {
        cattleId,
        reproductiveStatus: status,
        currentLactationNumber: currentLactation?.lactationNumber ?? 0,
        totalBreedings,
        totalPregnancies: pregnancies.length,
        totalCalvings,
        totalAbortions,
        firstCalvingDate: firstCalving?.calvingDate,
        lastBreedingDate: lastBreeding?.breedingDate,
        lastPregnancyCheckDate: lastDiagnosis?.diagnosisDate,
        lastCalvingDate: lastCalving?.calvingDate,
        currentPregnancyId: currentPregnancy?.id,
        currentLactationId: currentLactation?.id,
      },
      update: {
        reproductiveStatus: status,
        currentLactationNumber: currentLactation?.lactationNumber ?? 0,
        totalBreedings,
        totalPregnancies: pregnancies.length,
        totalCalvings,
        totalAbortions,
        firstCalvingDate: firstCalving?.calvingDate,
        lastBreedingDate: lastBreeding?.breedingDate,
        lastPregnancyCheckDate: lastDiagnosis?.diagnosisDate,
        lastCalvingDate: lastCalving?.calvingDate,
        currentPregnancyId: currentPregnancy?.id,
        currentLactationId: currentLactation?.id,
      },
    });
  }
}
