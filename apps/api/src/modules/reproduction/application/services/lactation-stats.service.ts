import { Injectable, NotFoundException } from '@nestjs/common';
import { LactationStatus, MilkSession } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { DEFAULT_SESSION_CONFIG } from 'src/modules/milk/domain/milk-anomaly';
import {
  averageDailyYield,
  daysBetween,
  sumYieldForDay,
  totalsByDisposition,
  YieldEntry,
} from '../../domain/lactation-yield';
import {
  buildDailyYieldSeries,
  CurveEntry,
  DailyYieldPoint,
} from '../../domain/lactation-curve';
import {
  computeLactationPersistency,
  LactationPersistency,
} from '../../domain/lactation-persistency';
import {
  computeDryOffProjection,
  computeStandardized305DayYield,
  DryOffProjectionResult,
} from '../../domain/lactation-dry-off-projection';
import {
  aggregateByBucket,
  alignSeriesByDim,
  DimAlignedPoint,
  dimRangeBucketKey,
  dimRangeBucketLabel,
  LactationComparisonGroupBy,
  LactationGroupBucketResult,
  LactationGroupSnapshot,
  parityBucketKey,
} from '../../domain/lactation-comparison';

interface LactationForAccess {
  id: string;
  cattleId: string;
  /** RAKHAL-287: needed to resolve "previous lactation = lactationNumber - 1" and to label each side of a comparison. */
  lactationNumber: number;
  startDate: Date;
  endDate: Date | null;
  cattleTagNumber: string;
  /** RAKHAL-284: stored on `Lactation`, recomputed by `MilkService.saveLog()` — read-only here. */
  peakMilkYield: number | null;
  peakMilkDate: Date | null;
  peakDaysInMilk: number | null;
  /** RAKHAL-285: `recommendedDryOffAt` is system-computed/stored by
   * `ReproductionService` (pregnancy-driven); `plannedDryOffAt` is
   * farmer-writable, read-only here. */
  recommendedDryOffAt: Date | null;
  plannedDryOffAt: Date | null;
}

/** One side of `GET /reproduction/lactations/compare` (RAKHAL-287). */
export interface LactationComparisonSummary {
  lactationId: string;
  lactationNumber: number;
  startDate: Date;
  endDate: Date | null;
  dim: number;
  sevenDayAvgYield: number;
  thirtyDayAvgYield: number;
  lactationToDate: ReturnType<typeof totalsByDisposition>;
  peak: { yieldL: number; date: Date; dim: number } | null;
  persistency: LactationPersistency | null;
}

/**
 * Read-only lactation stats + curve (RAKHAL-283). Derives everything from
 * `MilkLogEntry` rows — no new stored columns. Mirrors the direct-Prisma-
 * cross-module-read precedent already established both directions between
 * Reproduction and Milk (RAKHAL-277/278 read `Lactation` from `MilkService`;
 * `ReproductionService.summary()` reads `MilkLogEntry`-adjacent data too) —
 * `MilkModule` is not imported, no service dependency needed, just the
 * shared `PrismaService` + the pure domain functions in
 * `src/modules/reproduction/domain/lactation-{yield,curve}.ts`.
 */
@Injectable()
export class LactationStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
    private readonly farmSettings: FarmSettingsService,
  ) {
    this.logger.setContext(LactationStatsService.name);
  }

  async getStats(farmId: string, lactationId: string) {
    const lactation = await this.getLactationOrThrow(farmId, lactationId);
    const now = new Date();
    const rangeEnd = lactation.endDate ?? now;

    const entries = await this.prisma.milkLogEntry.findMany({
      where: {
        cattleId: lactation.cattleId,
        logDate: { gte: lactation.startDate, lte: rangeEnd },
      },
      select: { logDate: true, yieldL: true, disposition: true },
    });
    const yieldEntries: YieldEntry[] = entries;

    const referenceDate = rangeEnd < now ? rangeEnd : now;
    const sevenDayAvgYield = averageDailyYield(yieldEntries, {
      referenceDate,
      windowDays: 7,
      lactationStart: lactation.startDate,
    });

    // RAKHAL-284: peak is stored on `Lactation` (recomputed on write by
    // `MilkService.saveLog()`, not here — this is a read-only surface).
    // Persistency is derived at read time from that stored peak + the
    // 7-day average already computed above, so it's always fresh even
    // between milk-log writes (e.g. the day-count-since-peak advances daily
    // with no new write needed).
    const peak =
      lactation.peakMilkYield != null &&
      lactation.peakDaysInMilk != null &&
      lactation.peakMilkDate != null
        ? {
            yieldL: lactation.peakMilkYield,
            date: lactation.peakMilkDate,
            dim: lactation.peakDaysInMilk,
          }
        : null;
    const persistency: LactationPersistency | null =
      computeLactationPersistency({
        currentSevenDayAvgYield: sevenDayAvgYield,
        peakMilkYield: lactation.peakMilkYield,
        peakDaysInMilk: lactation.peakDaysInMilk,
        currentDaysInMilk: daysBetween(lactation.startDate, referenceDate),
      });

    const currentDaysInMilk = daysBetween(lactation.startDate, referenceDate);
    const lactationToDate = totalsByDisposition(yieldEntries);
    const dryOffProjection = await this.resolveDryOffProjection(
      farmId,
      lactation,
    );
    const minDim = await this.farmSettings.minDimFor305DayYield(farmId);

    return {
      lactationId: lactation.id,
      cattleId: lactation.cattleId,
      tagNumber: lactation.cattleTagNumber,
      startDate: lactation.startDate,
      endDate: lactation.endDate,
      today: sumYieldForDay(yieldEntries, referenceDate),
      sevenDayAvgYield,
      thirtyDayAvgYield: averageDailyYield(yieldEntries, {
        referenceDate,
        windowDays: 30,
        lactationStart: lactation.startDate,
      }),
      lactationToDate,
      peak,
      persistency,
      // RAKHAL-285: pregnancy-driven dry-off projection (primary metric) +
      // planned/farmer-set date, tracked separately so planned-vs-actual can
      // be compared later.
      recommendedDryOffAt: lactation.recommendedDryOffAt,
      plannedDryOffAt: lactation.plannedDryOffAt,
      managementEstimateDimRange: dryOffProjection.managementEstimateDimRange,
      dryOffConfidence: dryOffProjection.confidence,
      dryOffProjectionReason: dryOffProjection.reason,
      // RAKHAL-285: optional secondary comparison metric only — never the
      // primary projection/workflow driver (see this file's own domain
      // module doc comment). Null below the configured DIM threshold.
      standardized305DayYield: computeStandardized305DayYield({
        producedToDateL: lactationToDate.produced,
        daysInMilk: currentDaysInMilk,
        minDimThreshold: minDim,
      }),
    };
  }

  /**
   * RAKHAL-285: farmer-writable target dry-off date — independent of
   * `recommendedDryOffAt`, never touched by the system recompute
   * (`ReproductionService`'s pregnancy-diagnosis/abortion hooks).
   */
  async updatePlannedDryOff(
    farmId: string,
    lactationId: string,
    plannedDryOffAt: Date | null,
  ) {
    await this.getLactationOrThrow(farmId, lactationId);
    return this.prisma.lactation.update({
      where: { id: lactationId },
      data: { plannedDryOffAt },
    });
  }

  /**
   * `recommendedDryOffAt` is already stored/kept fresh by
   * `ReproductionService` (set on pregnancy confirmation, cleared on
   * abortion) — a non-null value there directly reflects "the dam currently
   * has an active pregnancy with a known expected-calving date", so the read
   * path here trusts it rather than re-deriving pregnancy state. Only when
   * it's null does this compute the not-pregnant management estimate, from
   * this cow's own prior ended-lactation lengths (or the documented fallback
   * range when she has none).
   */
  private async resolveDryOffProjection(
    farmId: string,
    lactation: LactationForAccess,
  ): Promise<DryOffProjectionResult> {
    if (lactation.recommendedDryOffAt) {
      return {
        recommendedDryOffAt: lactation.recommendedDryOffAt,
        managementEstimateDimRange: null,
        confidence: null,
        reason: null,
      };
    }

    const priorLactations = await this.prisma.lactation.findMany({
      where: {
        cattleId: lactation.cattleId,
        id: { not: lactation.id },
        endDate: { not: null },
      },
      select: { startDate: true, endDate: true },
    });
    const previousLactationLengthsDays = priorLactations
      .filter((l): l is { startDate: Date; endDate: Date } => l.endDate != null)
      .map((l) => daysBetween(l.startDate, l.endDate));

    return computeDryOffProjection({
      isPregnant: false,
      previousLactationLengthsDays,
    });
  }

  async getCurve(
    farmId: string,
    lactationId: string,
    compareLactationId?: string,
  ): Promise<{
    lactationId: string;
    cattleId: string;
    series: DailyYieldPoint[];
    compareLactationId: string | null;
    compareCattleId: string | null;
    compareSeries: DailyYieldPoint[] | null;
  }> {
    const lactation = await this.getLactationOrThrow(farmId, lactationId);
    const expectedSessions = await this.resolveExpectedSessions(farmId);

    const series = await this.buildSeriesFor(lactation, expectedSessions);

    let compareSeries: DailyYieldPoint[] | null = null;
    let compareLactation: LactationForAccess | null = null;
    if (compareLactationId) {
      compareLactation = await this.getLactationOrThrow(
        farmId,
        compareLactationId,
      );
      compareSeries = await this.buildSeriesFor(
        compareLactation,
        expectedSessions,
      );
    }

    return {
      lactationId: lactation.id,
      cattleId: lactation.cattleId,
      series,
      compareLactationId: compareLactation?.id ?? null,
      compareCattleId: compareLactation?.cattleId ?? null,
      compareSeries,
    };
  }

  private async buildSeriesFor(
    lactation: LactationForAccess,
    expectedSessions: MilkSession[],
  ): Promise<DailyYieldPoint[]> {
    const rangeEnd = lactation.endDate ?? new Date();
    const entries = await this.prisma.milkLogEntry.findMany({
      where: {
        cattleId: lactation.cattleId,
        logDate: { gte: lactation.startDate, lte: rangeEnd },
      },
      select: { logDate: true, session: true, yieldL: true },
    });
    const curveEntries: CurveEntry[] = entries;

    return buildDailyYieldSeries({
      startDate: lactation.startDate,
      endDate: rangeEnd,
      entries: curveEntries,
      expectedSessions,
    });
  }

  private async resolveExpectedSessions(
    farmId: string,
  ): Promise<MilkSession[]> {
    const configured = await this.farmSettings.milkActiveSessions(farmId);
    return configured.length > 0 ? configured : DEFAULT_SESSION_CONFIG;
  }

  /** Resolve a `Lactation` scoped to the active farm via its owning `Cattle` (tenant isolation). */
  private async getLactationOrThrow(
    farmId: string,
    lactationId: string,
  ): Promise<LactationForAccess> {
    const lactation = await this.prisma.lactation.findFirst({
      where: { id: lactationId, cattle: { farmId } },
      select: {
        id: true,
        cattleId: true,
        lactationNumber: true,
        startDate: true,
        endDate: true,
        peakMilkYield: true,
        peakMilkDate: true,
        peakDaysInMilk: true,
        recommendedDryOffAt: true,
        plannedDryOffAt: true,
        cattle: { select: { tagNumber: true } },
      },
    });

    if (!lactation) {
      throw new NotFoundException('Lactation not found');
    }

    return {
      id: lactation.id,
      cattleId: lactation.cattleId,
      lactationNumber: lactation.lactationNumber,
      startDate: lactation.startDate,
      endDate: lactation.endDate,
      cattleTagNumber: lactation.cattle.tagNumber,
      peakMilkYield: lactation.peakMilkYield,
      peakMilkDate: lactation.peakMilkDate,
      peakDaysInMilk: lactation.peakDaysInMilk,
      recommendedDryOffAt: lactation.recommendedDryOffAt,
      plannedDryOffAt: lactation.plannedDryOffAt,
    };
  }

  /**
   * RAKHAL-287: current vs. previous lactation for one cow, DIM-aligned (not
   * calendar-date aligned — see `alignSeriesByDim`,
   * `domain/lactation-comparison.ts`). Reuses the same stored peak columns
   * and `buildSeriesFor`/yield-domain helpers `getStats`/`getCurve` already
   * use, so this never disagrees with those endpoints about a lactation's
   * peak/persistency/yield.
   */
  async compareLactations(
    farmId: string,
    cattleId: string,
    byLactationNumber: boolean,
  ): Promise<{
    cattleId: string;
    tagNumber: string;
    byLactationNumber: boolean;
    current: LactationComparisonSummary;
    previous: LactationComparisonSummary | null;
    alignedSeries: DimAlignedPoint[];
  }> {
    const current = await this.getCurrentLactationOrThrow(farmId, cattleId);
    const previous = byLactationNumber
      ? await this.findLactationByNumber(
          farmId,
          cattleId,
          current.lactationNumber - 1,
        )
      : await this.findPreviousEndedLactation(farmId, cattleId, current.id);

    const expectedSessions = await this.resolveExpectedSessions(farmId);
    const [currentSeries, previousSeries] = await Promise.all([
      this.buildSeriesFor(current, expectedSessions),
      previous
        ? this.buildSeriesFor(previous, expectedSessions)
        : Promise.resolve([]),
    ]);

    const [currentSummary, previousSummary] = await Promise.all([
      this.buildComparisonSummary(current),
      previous ? this.buildComparisonSummary(previous) : Promise.resolve(null),
    ]);

    return {
      cattleId,
      tagNumber: current.cattleTagNumber,
      byLactationNumber,
      current: currentSummary,
      previous: previousSummary,
      alignedSeries: alignSeriesByDim(currentSeries, previousSeries),
    };
  }

  /**
   * RAKHAL-287: farm-level average yield/peak/persistency per bucket
   * (parity/shed/feed-group/DIM-range), over every currently-`ACTIVE`
   * lactation on the farm. Peak/persistency are read off each lactation's
   * already-stored/kept-fresh columns (RAKHAL-284); the rolling 7-day
   * average is computed fresh per cow from the same `MilkLogEntry`/
   * `averageDailyYield` path `getStats()` uses, batched into one query for
   * the whole farm rather than N round trips.
   */
  async compareGroups(
    farmId: string,
    groupBy: LactationComparisonGroupBy,
  ): Promise<LactationGroupBucketResult[]> {
    const now = new Date();
    const activeLactations = await this.prisma.lactation.findMany({
      where: { status: LactationStatus.ACTIVE, cattle: { farmId } },
      select: {
        id: true,
        cattleId: true,
        lactationNumber: true,
        startDate: true,
        endDate: true,
        peakMilkYield: true,
        peakDaysInMilk: true,
        cattle: {
          select: {
            shedId: true,
            feedGroupId: true,
            shed: { select: { name: true } },
            feedGroup: { select: { name: true } },
          },
        },
      },
    });

    if (activeLactations.length === 0) return [];

    const cattleIds = activeLactations.map((l) => l.cattleId);
    const earliestStart = activeLactations.reduce(
      (min, l) => (l.startDate < min ? l.startDate : min),
      activeLactations[0].startDate,
    );
    const entries = await this.prisma.milkLogEntry.findMany({
      where: { cattleId: { in: cattleIds }, logDate: { gte: earliestStart } },
      select: {
        cattleId: true,
        logDate: true,
        yieldL: true,
        disposition: true,
      },
    });
    const entriesByCattle = new Map<string, YieldEntry[]>();
    for (const entry of entries) {
      const bucket = entriesByCattle.get(entry.cattleId) ?? [];
      bucket.push(entry);
      entriesByCattle.set(entry.cattleId, bucket);
    }

    const snapshots: LactationGroupSnapshot[] = activeLactations.map(
      (lactation) => {
        const dim = daysBetween(lactation.startDate, now);
        const sevenDayAvgYield = averageDailyYield(
          entriesByCattle.get(lactation.cattleId) ?? [],
          {
            referenceDate: now,
            windowDays: 7,
            lactationStart: lactation.startDate,
          },
        );
        const persistency = computeLactationPersistency({
          currentSevenDayAvgYield: sevenDayAvgYield,
          peakMilkYield: lactation.peakMilkYield,
          peakDaysInMilk: lactation.peakDaysInMilk,
          currentDaysInMilk: dim,
        });

        const { bucketKey, bucketLabel } = this.resolveGroupBucket(groupBy, {
          lactationNumber: lactation.lactationNumber,
          dim,
          shedId: lactation.cattle.shedId,
          shedName: lactation.cattle.shed?.name ?? null,
          feedGroupId: lactation.cattle.feedGroupId,
          feedGroupName: lactation.cattle.feedGroup?.name ?? null,
        });

        return {
          cattleId: lactation.cattleId,
          lactationId: lactation.id,
          bucketKey,
          bucketLabel,
          dim,
          sevenDayAvgYield,
          peakMilkYield: lactation.peakMilkYield,
          persistencyPct: persistency?.persistencyPct ?? null,
        };
      },
    );

    return aggregateByBucket(snapshots);
  }

  private resolveGroupBucket(
    groupBy: LactationComparisonGroupBy,
    input: {
      lactationNumber: number;
      dim: number;
      shedId: string | null;
      shedName: string | null;
      feedGroupId: string | null;
      feedGroupName: string | null;
    },
  ): { bucketKey: string; bucketLabel: string } {
    switch (groupBy) {
      case 'parity': {
        const key = parityBucketKey(input.lactationNumber);
        return { bucketKey: key, bucketLabel: `Parity ${key}` };
      }
      case 'dimRange': {
        const key = dimRangeBucketKey(input.dim);
        return { bucketKey: key, bucketLabel: dimRangeBucketLabel(key) };
      }
      case 'shed':
        return {
          bucketKey: input.shedId ?? 'UNASSIGNED',
          bucketLabel: input.shedName ?? 'Unassigned',
        };
      case 'feedGroup':
        return {
          bucketKey: input.feedGroupId ?? 'UNASSIGNED',
          bucketLabel: input.feedGroupName ?? 'Unassigned',
        };
    }
  }

  private async buildComparisonSummary(
    lactation: LactationForAccess,
  ): Promise<LactationComparisonSummary> {
    const now = new Date();
    const rangeEnd = lactation.endDate ?? now;
    const referenceDate = rangeEnd < now ? rangeEnd : now;

    const entries = await this.prisma.milkLogEntry.findMany({
      where: {
        cattleId: lactation.cattleId,
        logDate: { gte: lactation.startDate, lte: rangeEnd },
      },
      select: { logDate: true, yieldL: true, disposition: true },
    });
    const yieldEntries: YieldEntry[] = entries;
    const dim = daysBetween(lactation.startDate, referenceDate);

    const sevenDayAvgYield = averageDailyYield(yieldEntries, {
      referenceDate,
      windowDays: 7,
      lactationStart: lactation.startDate,
    });
    const peak =
      lactation.peakMilkYield != null &&
      lactation.peakDaysInMilk != null &&
      lactation.peakMilkDate != null
        ? {
            yieldL: lactation.peakMilkYield,
            date: lactation.peakMilkDate,
            dim: lactation.peakDaysInMilk,
          }
        : null;

    return {
      lactationId: lactation.id,
      lactationNumber: lactation.lactationNumber,
      startDate: lactation.startDate,
      endDate: lactation.endDate,
      dim,
      sevenDayAvgYield,
      thirtyDayAvgYield: averageDailyYield(yieldEntries, {
        referenceDate,
        windowDays: 30,
        lactationStart: lactation.startDate,
      }),
      lactationToDate: totalsByDisposition(yieldEntries),
      peak,
      persistency: computeLactationPersistency({
        currentSevenDayAvgYield: sevenDayAvgYield,
        peakMilkYield: lactation.peakMilkYield,
        peakDaysInMilk: lactation.peakDaysInMilk,
        currentDaysInMilk: dim,
      }),
    };
  }

  /** Current `ACTIVE` lactation for a cow, farm-scoped via the owning `Cattle`. */
  private async getCurrentLactationOrThrow(
    farmId: string,
    cattleId: string,
  ): Promise<LactationForAccess> {
    const lactation = await this.prisma.lactation.findFirst({
      where: {
        cattleId,
        status: LactationStatus.ACTIVE,
        cattle: { farmId },
      },
      select: this.lactationForAccessSelect(),
    });
    if (!lactation) {
      throw new NotFoundException('No active lactation found for this cattle');
    }
    return this.mapLactationForAccess(lactation);
  }

  private async findLactationByNumber(
    farmId: string,
    cattleId: string,
    lactationNumber: number,
  ): Promise<LactationForAccess | null> {
    if (lactationNumber < 1) return null;
    const lactation = await this.prisma.lactation.findFirst({
      where: { cattleId, lactationNumber, cattle: { farmId } },
      select: this.lactationForAccessSelect(),
    });
    return lactation ? this.mapLactationForAccess(lactation) : null;
  }

  private async findPreviousEndedLactation(
    farmId: string,
    cattleId: string,
    excludeLactationId: string,
  ): Promise<LactationForAccess | null> {
    const lactation = await this.prisma.lactation.findFirst({
      where: {
        cattleId,
        id: { not: excludeLactationId },
        endDate: { not: null },
        cattle: { farmId },
      },
      orderBy: [{ endDate: 'desc' }],
      select: this.lactationForAccessSelect(),
    });
    return lactation ? this.mapLactationForAccess(lactation) : null;
  }

  private lactationForAccessSelect() {
    return {
      id: true,
      cattleId: true,
      lactationNumber: true,
      startDate: true,
      endDate: true,
      peakMilkYield: true,
      peakMilkDate: true,
      peakDaysInMilk: true,
      recommendedDryOffAt: true,
      plannedDryOffAt: true,
      cattle: { select: { tagNumber: true } },
    } as const;
  }

  private mapLactationForAccess(lactation: {
    id: string;
    cattleId: string;
    lactationNumber: number;
    startDate: Date;
    endDate: Date | null;
    peakMilkYield: number | null;
    peakMilkDate: Date | null;
    peakDaysInMilk: number | null;
    recommendedDryOffAt: Date | null;
    plannedDryOffAt: Date | null;
    cattle: { tagNumber: string };
  }): LactationForAccess {
    return {
      id: lactation.id,
      cattleId: lactation.cattleId,
      lactationNumber: lactation.lactationNumber,
      startDate: lactation.startDate,
      endDate: lactation.endDate,
      cattleTagNumber: lactation.cattle.tagNumber,
      peakMilkYield: lactation.peakMilkYield,
      peakMilkDate: lactation.peakMilkDate,
      peakDaysInMilk: lactation.peakDaysInMilk,
      recommendedDryOffAt: lactation.recommendedDryOffAt,
      plannedDryOffAt: lactation.plannedDryOffAt,
    };
  }
}
