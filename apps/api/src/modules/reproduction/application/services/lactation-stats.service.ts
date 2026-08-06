import { Injectable, NotFoundException } from '@nestjs/common';
import { MilkSession } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { FarmSettingsService } from 'src/modules/farm-settings/farm-settings.service';
import { DEFAULT_SESSION_CONFIG } from 'src/modules/milk/domain/milk-anomaly';
import {
  averageDailyYield,
  sumYieldForDay,
  totalsByDisposition,
  YieldEntry,
} from '../../domain/lactation-yield';
import {
  buildDailyYieldSeries,
  CurveEntry,
  DailyYieldPoint,
} from '../../domain/lactation-curve';

interface LactationForAccess {
  id: string;
  cattleId: string;
  startDate: Date;
  endDate: Date | null;
  cattleTagNumber: string;
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

    return {
      lactationId: lactation.id,
      cattleId: lactation.cattleId,
      tagNumber: lactation.cattleTagNumber,
      startDate: lactation.startDate,
      endDate: lactation.endDate,
      today: sumYieldForDay(yieldEntries, referenceDate),
      sevenDayAvgYield: averageDailyYield(yieldEntries, {
        referenceDate,
        windowDays: 7,
        lactationStart: lactation.startDate,
      }),
      thirtyDayAvgYield: averageDailyYield(yieldEntries, {
        referenceDate,
        windowDays: 30,
        lactationStart: lactation.startDate,
      }),
      lactationToDate: totalsByDisposition(yieldEntries),
    };
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
    };
  }
}
