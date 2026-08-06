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
   * Recent-heat lookback window, in days (RAKHAL-271) — a `HeatEvent` inside
   * this window contributes the `HEAT_DETECTED` `ReproductionAlert` (v2: alerts
   * are derived and layered on top of `ReproductionState`, not a state of
   * their own).
   */
  async reproHeatWindowDays(farmId: string): Promise<number> {
    return (await this.getEffective(farmId)).reproHeatWindowDays;
  }

  /**
   * Close-up window before `Pregnancy.expectedCalvingDate`, in days
   * (RAKHAL-271) — inside it, a `PREGNANT` cow gains the `CALVING_DUE`
   * `ReproductionAlert` (v2: no longer a separate `ReproductionState`).
   */
  async reproCloseUpWindowDays(farmId: string): Promise<number> {
    return (await this.getEffective(farmId)).reproCloseUpWindowDays;
  }

  /**
   * `LactationStage` day thresholds, in days since `Lactation.startDate`
   * (RAKHAL-273) — `deriveLactationStage`'s FRESH/EARLY/MID cutoffs (LATE is
   * everything beyond `mid` until dry-off).
   */
  async lactationStageThresholds(
    farmId: string,
  ): Promise<{ freshDays: number; earlyDays: number; midDays: number }> {
    const s = await this.getEffective(farmId);
    return {
      freshDays: s.lactationFreshDays,
      earlyDays: s.lactationEarlyDays,
      midDays: s.lactationMidDays,
    };
  }

  /**
   * `PregnancyStage` day thresholds, in days since `Pregnancy.conceptionDate`
   * (RAKHAL-273) — `derivePregnancyStage`'s EARLY/MID cutoffs (LATE runs from
   * `mid` up to the close-up window, `reproCloseUpWindowDays`, which then
   * becomes CLOSE_UP).
   */
  async pregnancyStageThresholds(
    farmId: string,
  ): Promise<{ earlyDays: number; midDays: number }> {
    const s = await this.getEffective(farmId);
    return { earlyDays: s.pregnancyEarlyDays, midDays: s.pregnancyMidDays };
  }

  /**
   * Extra days past `expectedPregnancyCheckDate` (on top of the plain
   * `PREGNANCY_CHECK_DUE` alert) before `OVERDUE_PREGNANCY_CHECK` fires
   * (RAKHAL-272).
   */
  async reproOverduePregnancyCheckDays(farmId: string): Promise<number> {
    return (await this.getEffective(farmId)).reproOverduePregnancyCheckDays;
  }

  /**
   * `BreedingEvent` count since a cow's last successful outcome before
   * `REPEAT_BREEDER` fires (RAKHAL-272).
   */
  async reproRepeatBreederThreshold(farmId: string): Promise<number> {
    return (await this.getEffective(farmId)).reproRepeatBreederThreshold;
  }

  /**
   * Days since a cow's last calving with no confirmed pregnancy since before
   * `LONG_DAYS_OPEN` fires (RAKHAL-272).
   */
  async reproLongDaysOpenDays(farmId: string): Promise<number> {
    return (await this.getEffective(farmId)).reproLongDaysOpenDays;
  }

  /**
   * Extra days past `expectedCalvingDate` before `CALVING_OVERDUE` fires
   * (RAKHAL-272 extension — see `reproduction-alerts.ts`'s file-level doc
   * comment for why this alert is implemented here rather than deferred).
   */
  async reproCalvingOverdueDays(farmId: string): Promise<number> {
    return (await this.getEffective(farmId)).reproCalvingOverdueDays;
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
   * Days since `Lactation.startDate` a fresh cow's milk stays classified
   * `MilkDisposition.COLOSTRUM` (RAKHAL-277).
   */
  async milkColostrumWindowDays(farmId: string): Promise<number> {
    return (await this.getEffective(farmId)).milkColostrumWindowDays;
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

  /**
   * Minimum recorded days-in-milk before `standardized305DayYield` is exposed
   * (RAKHAL-285) — below this, a 305-day projection from too few real days is
   * unreliable and stays null.
   */
  async minDimFor305DayYield(farmId: string): Promise<number> {
    return (await this.getEffective(farmId)).minDimFor305DayYield;
  }
}
