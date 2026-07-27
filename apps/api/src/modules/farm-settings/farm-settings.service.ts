import { Injectable } from '@nestjs/common';
import { FarmModuleSettings, MilkSession, Prisma } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';

/**
 * Shared resolver for per-farm module settings (`FarmModuleSettings`, RAKHAL-032 /
 * RD-016). Feature modules (Finance, Milk, Reproduction, …) read their tunables
 * through this seam instead of hard-coding constants, so editing `PATCH
 * /settings/modules` actually changes behaviour. The row is lazily created with the
 * schema defaults on first access; subsequent reads are plain indexed lookups.
 *
 * Lives in its own lean module (Prisma + Logger only) so consumers don't pull in
 * the Settings module's controllers/guards and no dependency cycle forms.
 */
@Injectable()
export class FarmSettingsService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    logger: LoggerService,
  ) {
    this.log = logger.setContext(FarmSettingsService.name);
  }

  /** The farm's module settings, lazily created with schema defaults on first access. */
  async getEffective(farmId: string): Promise<FarmModuleSettings> {
    const existing = await this.prisma.farmModuleSettings.findUnique({
      where: { farmId },
    });
    if (existing) return existing;
    try {
      return await this.prisma.farmModuleSettings.create({ data: { farmId } });
    } catch (e) {
      // Concurrent first-access create — fall back to the row the other write made.
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === 'P2002'
      ) {
        return this.prisma.farmModuleSettings.findUniqueOrThrow({
          where: { farmId },
        });
      }
      throw e;
    }
  }

  /** Reproduction voluntary waiting period, in days (PRD §9). */
  async reproVwpDays(farmId: string): Promise<number> {
    return (await this.getEffective(farmId)).reproVwpDays;
  }

  /** Dry-period target length, in days (PRD §9) — projects `DryPeriod.expectedEndDate`. */
  async reproDryPeriodTargetDays(farmId: string): Promise<number> {
    return (await this.getEffective(farmId)).reproDryPeriodTargetDays;
  }

  /**
   * Milk-anomaly cutoff as a fraction of the 7-day average — a session below it is
   * flagged. `anomalyThresholdPct` is the drop %, so 30 → 0.70 (PRD §10.2).
   */
  async milkAnomalyFraction(farmId: string): Promise<number> {
    const pct = (await this.getEffective(farmId)).milkAnomalyThresholdPct;
    return Math.max(0, Math.min(1, 1 - pct / 100));
  }

  /** Finance survival-runway status thresholds, in days (PRD §16). */
  async financeRunwayThresholds(
    farmId: string,
  ): Promise<{ warningDays: number; criticalDays: number }> {
    const s = await this.getEffective(farmId);
    return {
      warningDays: s.financeRunwayWarningDays,
      criticalDays: s.financeRunwayCriticalDays,
    };
  }

  /** Herd-health-score warning threshold, % (PRD §13 / dashboard KPI). */
  async healthScoreWarningPct(farmId: string): Promise<number> {
    return (await this.getEffective(farmId)).healthScoreWarningPct;
  }

  /**
   * The farm's configured milk sessions as enum values (PRD §10). Stored as
   * lowercase strings; mapped to `MilkSession` and filtered to the valid set.
   */
  async milkActiveSessions(farmId: string): Promise<MilkSession[]> {
    const stored = (await this.getEffective(farmId)).milkActiveSessions;
    const valid = new Set<string>(Object.values(MilkSession));
    return stored
      .map((s) => s.toUpperCase())
      .filter((s) => valid.has(s)) as MilkSession[];
  }
}
