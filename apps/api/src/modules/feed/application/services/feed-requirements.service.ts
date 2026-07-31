import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { MilkService } from 'src/modules/milk/application/services/milk.service';
import {
  AnimalType,
  computeRequirements,
  Requirements,
  RequirementsInput,
} from '../../domain/requirements';
import { FeedRequirementsQueryDto } from '../../presentation/dto/feed-requirements-query.dto';

const MS_PER_DAY = 86_400_000;

/** Nutritional-requirements calculator (PRD §12.4, RAKHAL-081). Thin wrapper over the pure domain,
 * plus (2026-07-17, user request) two cow-driven modes that auto-derive `weightKg`/`milkTargetL`/
 * `gestationDays`/`bcs` from real cattle/reproduction/milk records instead of manual entry:
 * `cattleId` (single cow) or `feedGroupId` (group average + group total). Falls back to the manual
 * `weightKg`/`milkTargetL` query fields when a cow's records are incomplete, so this never silently
 * fabricates a number — every derived input is flagged in the response's `data_source` block. */
@Injectable()
export class FeedRequirementsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly milk: MilkService,
  ) {}

  async calc(farmId: string, query: FeedRequirementsQueryDto) {
    if (query.cattleId)
      return this.calcForCattle(farmId, query.cattleId, query);
    if (query.feedGroupId)
      return this.calcForFeedGroup(farmId, query.feedGroupId, query);
    return this.calcManual(query);
  }

  private calcManual(query: FeedRequirementsQueryDto) {
    const req = computeRequirements({
      weightKg: query.weightKg as number,
      milkTargetL: query.milkTargetL as number,
      milkFatPct: query.milkFatPct,
      milkProteinPct: query.milkProteinPct,
      gestationDays: query.gestationDays,
      bcs: query.bcs,
      dim: query.dim,
      animalType: query.animalType,
    });
    return {
      inputs: {
        weight_kg: query.weightKg as number,
        milk_target_l: query.milkTargetL as number,
        milk_fat_pct: query.milkFatPct ?? 4.0,
        milk_protein_pct: query.milkProteinPct,
        gestation_days: query.gestationDays,
        bcs: query.bcs,
        dim: query.dim,
        animal_type: query.animalType ?? 'COW',
      },
      data_source: { weight: 'manual', milk_yield: 'manual' },
      requirements: this.reqShape(req),
    };
  }

  /** MILKING/FRESH → lactating cow; DRY → dry cow; GROWING → heifer (young stock, not yet
   * in production). SOLD/DECEASED cows are excluded upstream (`isActive` scoping) and
   * default to COW here as a harmless fallback. */
  private inferAnimalType(
    productionStatus: string | null | undefined,
  ): AnimalType {
    if (productionStatus === 'DRY') return 'DRY';
    if (productionStatus === 'GROWING') return 'HEIFER';
    return 'COW';
  }

  /** Single cow, auto-derived from `Cattle.lastWeightKg`/`lastBcs`, the active `Pregnancy` (if any,
   * via `ReproductionProfile.currentPregnancyId`), and `MilkService.averageDailyYield` (7-day
   * trailing average). Falls back to the manual `weightKg`/`milkTargetL` query fields when a
   * record is missing. */
  private async calcForCattle(
    farmId: string,
    cattleId: string,
    query: FeedRequirementsQueryDto,
  ) {
    const cattle = await this.prisma.cattle.findFirst({
      where: { id: cattleId, farmId },
      select: {
        id: true,
        lastWeightKg: true,
        lastBcs: true,
        productionStatus: true,
      },
    });
    if (!cattle) throw new NotFoundException('Cattle not found');
    const animalType =
      query.animalType ?? this.inferAnimalType(cattle.productionStatus);

    const [gestationDays, avgYield] = await Promise.all([
      this.currentGestationDays(cattleId),
      this.milk.averageDailyYield(farmId, [cattleId]),
    ]);

    const weightSource =
      cattle.lastWeightKg != null ? 'cattle_record' : 'manual';
    const weightKg = cattle.lastWeightKg ?? query.weightKg;
    if (weightKg == null) {
      throw new BadRequestException(
        'Cattle has no recorded weight — supply weightKg manually',
      );
    }

    const milkFromRecords = avgYield.get(cattleId);
    const milkSource =
      milkFromRecords != null
        ? 'milk_log_7d_avg'
        : query.milkTargetL != null
          ? 'manual'
          : 'assumed_zero';
    const milkTargetL = milkFromRecords ?? query.milkTargetL ?? 0;

    const input: RequirementsInput = {
      weightKg,
      milkTargetL,
      milkFatPct: query.milkFatPct,
      milkProteinPct: query.milkProteinPct,
      gestationDays: query.gestationDays ?? gestationDays ?? undefined,
      bcs: query.bcs ?? cattle.lastBcs ?? undefined,
      dim: query.dim,
      animalType,
    };
    const req = computeRequirements(input);

    return {
      inputs: {
        weight_kg: weightKg,
        milk_target_l: milkTargetL,
        milk_fat_pct: query.milkFatPct ?? 4.0,
        gestation_days: input.gestationDays,
        bcs: input.bcs,
        dim: query.dim,
        animal_type: animalType,
      },
      data_source: { weight: weightSource, milk_yield: milkSource },
      requirements: this.reqShape(req),
    };
  }

  /** Feed group — averages `weightKg`/milk yield across active members (cows missing a record are
   * skipped from that average, not zero-filled) and computes both a per-cow requirement (from the
   * averaged inputs) and a group total (per-cow × headcount, what a batch-production quantity
   * needs). */
  private async calcForFeedGroup(
    farmId: string,
    feedGroupId: string,
    query: FeedRequirementsQueryDto,
  ) {
    const group = await this.prisma.feedGroup.findFirst({
      where: { id: feedGroupId, farmId },
      select: { id: true },
    });
    if (!group) throw new NotFoundException('Feed group not found');

    const cattle = await this.prisma.cattle.findMany({
      where: { farmId, feedGroupId, isActive: true },
      select: { id: true, lastWeightKg: true, lastBcs: true },
    });
    const headcount = cattle.length;
    if (headcount === 0) {
      throw new BadRequestException('Feed group has no active cattle');
    }

    const cattleIds = cattle.map((c) => c.id);
    const avgYieldByCow = await this.milk.averageDailyYield(farmId, cattleIds);

    const weights = cattle
      .map((c) => c.lastWeightKg)
      .filter((w): w is number => w != null);
    const bcsValues = cattle
      .map((c) => c.lastBcs)
      .filter((b): b is number => b != null);
    const yields = cattleIds
      .map((id) => avgYieldByCow.get(id))
      .filter((y): y is number => y != null);

    const avg = (values: number[]) =>
      values.length > 0
        ? values.reduce((a, b) => a + b, 0) / values.length
        : undefined;

    const weightKg = avg(weights) ?? query.weightKg;
    if (weightKg == null) {
      throw new BadRequestException(
        'No cattle in this group have a recorded weight — supply weightKg manually',
      );
    }
    const milkTargetL = avg(yields) ?? query.milkTargetL ?? 0;
    const bcs = avg(bcsValues);

    const req = computeRequirements({
      weightKg,
      milkTargetL,
      milkFatPct: query.milkFatPct,
      milkProteinPct: query.milkProteinPct,
      gestationDays: query.gestationDays,
      bcs: query.bcs ?? bcs,
      dim: query.dim,
      animalType: query.animalType,
    });

    return {
      inputs: {
        weight_kg: round2(weightKg),
        milk_target_l: round2(milkTargetL),
        milk_fat_pct: query.milkFatPct ?? 4.0,
        bcs:
          (query.bcs ?? bcs) != null
            ? round2((query.bcs ?? bcs) as number)
            : null,
        animal_type: query.animalType ?? 'COW',
        headcount,
        cattle_with_weight: weights.length,
        cattle_with_milk_data: yields.length,
      },
      data_source: {
        weight: weights.length > 0 ? 'cattle_record_avg' : 'manual',
        milk_yield:
          yields.length > 0
            ? 'milk_log_7d_avg'
            : query.milkTargetL != null
              ? 'manual'
              : 'assumed_zero',
      },
      per_cow: this.reqShape(req),
      group_total: this.reqShape(scaleRequirements(req, headcount)),
    };
  }

  /** Live gestation day count from the cow's active pregnancy (`ReproductionProfile.currentPregnancyId`
   * → `Pregnancy.conceptionDate`), not the stored `Pregnancy.gestationDays` snapshot (which is only
   * set at diagnosis time and would go stale). `null` when the cow has no active pregnancy. */
  private async currentGestationDays(cattleId: string): Promise<number | null> {
    const profile = await this.prisma.reproductionProfile.findUnique({
      where: { cattleId },
      select: { currentPregnancyId: true },
    });
    if (!profile?.currentPregnancyId) return null;
    const pregnancy = await this.prisma.pregnancy.findFirst({
      where: { id: profile.currentPregnancyId, status: 'ACTIVE' },
      select: { conceptionDate: true },
    });
    if (!pregnancy) return null;
    return Math.max(
      0,
      Math.floor(
        (Date.now() - pregnancy.conceptionDate.getTime()) / MS_PER_DAY,
      ),
    );
  }

  private reqShape(req: Requirements) {
    return {
      dm_kg: req.dmKg,
      cp_kg: req.cpKg,
      me_mj: req.meMj,
      ndf_kg: req.ndfKg,
      fat_kg: req.fatKg,
      ne_mcal: req.neMcal,
      energy_density_mj_per_kg_dm: req.energyDensityMjPerKgDm,
      cp_pct_of_dm: req.cpPctOfDm,
      tdn_kg: req.tdnKg,
      calcium_kg: req.calciumKg,
      phosphorus_kg: req.phosphorusKg,
      adf_kg: req.adfKg,
      rdp_pct: req.rdpPct,
      rup_pct: req.rupPct,
      ndf_max_kg: req.ndfMaxKg,
      ca_p_ratio_target: req.caPRatioTarget,
      breakdown: {
        dm: req.breakdown.dm,
        me: req.breakdown.me,
        cp: req.breakdown.cp,
      },
    };
  }
}

const round2 = (v: number) => Math.round(v * 100) / 100;

function scaleRequirements(req: Requirements, factor: number): Requirements {
  return {
    dmKg: round2(req.dmKg * factor),
    cpKg: round2(req.cpKg * factor),
    meMj: round2(req.meMj * factor),
    ndfKg: round2(req.ndfKg * factor),
    fatKg: round2(req.fatKg * factor),
    neMcal: round2(req.neMcal * factor),
    energyDensityMjPerKgDm: req.energyDensityMjPerKgDm,
    cpPctOfDm: req.cpPctOfDm,
    tdnKg: round2(req.tdnKg * factor),
    calciumKg: round2(req.calciumKg * factor),
    phosphorusKg: round2(req.phosphorusKg * factor),
    adfKg: round2(req.adfKg * factor),
    rdpPct: req.rdpPct,
    rupPct: req.rupPct,
    ndfMaxKg: round2(req.ndfMaxKg * factor),
    caPRatioTarget: req.caPRatioTarget,
    breakdown: {
      dm: {
        lactation: round2(req.breakdown.dm.lactation * factor),
        pregnancy: round2(req.breakdown.dm.pregnancy * factor),
        heiferGrowth: round2(req.breakdown.dm.heiferGrowth * factor),
        bcsAdjustment: round2(req.breakdown.dm.bcsAdjustment * factor),
      },
      me: {
        maintenance: round2(req.breakdown.me.maintenance * factor),
        milk: round2(req.breakdown.me.milk * factor),
        pregnancy: round2(req.breakdown.me.pregnancy * factor),
        heiferGrowth: round2(req.breakdown.me.heiferGrowth * factor),
      },
      cp: {
        maintenance: round2(req.breakdown.cp.maintenance * factor),
        milk: round2(req.breakdown.cp.milk * factor),
        pregnancy: round2(req.breakdown.cp.pregnancy * factor),
        heiferGrowth: round2(req.breakdown.cp.heiferGrowth * factor),
      },
    },
  };
}
