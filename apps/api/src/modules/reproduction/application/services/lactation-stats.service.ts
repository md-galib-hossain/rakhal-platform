import { Injectable, NotFoundException } from '@nestjs/common';
import { MilkSession } from '@prisma/client';
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

interface LactationForAccess {
  id: string;
  cattleId: string;
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
