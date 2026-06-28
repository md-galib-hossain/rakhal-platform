import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { FeedConcentration, FeedConcentrationItem } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import {
  EffectiveIngredient,
  resolveEffective,
} from '../../domain/ingredient-resolver';
import {
  balanceScore,
  computeTotals,
  FormulaLine,
  normalize,
} from '../../domain/formula-math';
import { computeRequirements, Requirements } from '../../domain/requirements';
import {
  CreateConcentrationDto,
  NormalizeConcentrationDto,
  UpdateConcentrationDto,
} from '../../presentation/dto/concentration.dto';

type ConcentrationWithItems = FeedConcentration & {
  items: FeedConcentrationItem[];
};

/**
 * Concentration templates (PRD §12.3–12.4, RAKHAL-082): the formula builder.
 * Persists name + target + ingredient lines; on read, enriches with nutritional
 * totals, a 0–100 balance score vs the target's requirements, and cost — all via
 * the pure `formula-math`/`requirements` domain. `normalize` scales a draft to
 * meet the dry-matter target. Farm-scoped throughout.
 */
@Injectable()
export class FeedConcentrationService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(FeedConcentrationService.name);
  }

  async list(farmId: string) {
    const rows = await this.prisma.feedConcentration.findMany({
      where: { farmId, isActive: true },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    return Promise.all(rows.map((r) => this.enrich(farmId, r)));
  }

  async get(farmId: string, id: string) {
    const row = await this.getOrThrow(farmId, id);
    return this.enrich(farmId, row, true);
  }

  async create(farmId: string, userId: string, dto: CreateConcentrationDto) {
    await this.validateTargets(farmId, dto.feedGroupId, dto.cattleId);
    await this.assertIngredients(dto.items.map((i) => i.ingredientId));

    const created = await this.prisma.feedConcentration.create({
      data: {
        farmId,
        name: dto.name,
        durationDays: dto.durationDays,
        targetType: dto.targetType,
        feedGroupId: dto.feedGroupId,
        cattleId: dto.cattleId,
        targetWeightKg: dto.targetWeightKg,
        targetMilkL: dto.targetMilkL,
        createdBy: userId,
        items: {
          create: dto.items.map((i) => ({
            ingredientId: i.ingredientId,
            amountKg: i.amountKg,
          })),
        },
      },
      include: { items: true },
    });
    this.log.info('Feed concentration created', { farmId, id: created.id });
    return this.enrich(farmId, created, true);
  }

  async update(farmId: string, id: string, dto: UpdateConcentrationDto) {
    await this.getOrThrow(farmId, id);
    await this.validateTargets(farmId, dto.feedGroupId, dto.cattleId);
    if (dto.items) {
      await this.assertIngredients(dto.items.map((i) => i.ingredientId));
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      if (dto.items) {
        await tx.feedConcentrationItem.deleteMany({
          where: { concentrationId: id },
        });
        await tx.feedConcentrationItem.createMany({
          data: dto.items.map((i) => ({
            concentrationId: id,
            ingredientId: i.ingredientId,
            amountKg: i.amountKg,
          })),
        });
      }
      return tx.feedConcentration.update({
        where: { id },
        data: {
          name: dto.name,
          durationDays: dto.durationDays,
          targetType: dto.targetType,
          feedGroupId: dto.feedGroupId,
          cattleId: dto.cattleId,
          targetWeightKg: dto.targetWeightKg,
          targetMilkL: dto.targetMilkL,
        },
        include: { items: true },
      });
    });
    this.log.info('Feed concentration updated', { farmId, id });
    return this.enrich(farmId, updated, true);
  }

  async remove(farmId: string, id: string) {
    await this.getOrThrow(farmId, id);
    await this.prisma.feedConcentration.update({
      where: { id },
      data: { isActive: false },
    });
    this.log.info('Feed concentration archived', { farmId, id });
    return { id, archived: true };
  }

  /** Scale a draft formula's amounts so total DM meets the requirement (§12.4). */
  async normalize(farmId: string, dto: NormalizeConcentrationDto) {
    await this.assertIngredients(dto.items.map((i) => i.ingredientId));
    const effById = await this.effectiveMap(
      farmId,
      dto.items.map((i) => i.ingredientId),
    );
    const req = computeRequirements({
      weightKg: dto.weightKg,
      milkTargetL: dto.milkTargetL,
      milkFatPct: dto.milkFatPct,
    });
    const lines: FormulaLine[] = dto.items.map((i) => ({
      ingredientId: i.ingredientId,
      amountKg: i.amountKg,
    }));
    const normalized = normalize(lines, req, effById);
    const comp = computeTotals(normalized, effById);
    return {
      requirements: this.reqShape(req),
      items: normalized.map((l) => ({
        ingredient_id: l.ingredientId,
        amount_kg: l.amountKg,
      })),
      totals: comp.totals,
      balance_score: balanceScore(comp.totals, req),
    };
  }

  // ---- internals ----------------------------------------------------------

  private async enrich(
    farmId: string,
    row: ConcentrationWithItems,
    detailed = false,
  ) {
    const ids = row.items.map((i) => i.ingredientId);
    const effById = await this.effectiveMap(farmId, ids);
    const lines: FormulaLine[] = row.items.map((i) => ({
      ingredientId: i.ingredientId,
      amountKg: i.amountKg,
    }));
    const comp = computeTotals(lines, effById);

    const req: Requirements | null =
      row.targetWeightKg != null && row.targetMilkL != null
        ? computeRequirements({
            weightKg: row.targetWeightKg,
            milkTargetL: row.targetMilkL,
          })
        : null;
    const balance = req ? balanceScore(comp.totals, req) : null;

    const base = {
      id: row.id,
      name: row.name,
      target_type: row.targetType,
      feed_group_id: row.feedGroupId,
      cattle_id: row.cattleId,
      duration_days: row.durationDays,
      target_weight_kg: row.targetWeightKg,
      target_milk_l: row.targetMilkL,
      totals: comp.totals,
      balance_score: balance,
      requirements: req ? this.reqShape(req) : null,
      created_at: row.createdAt,
    };
    if (!detailed) return base;

    const ingNames = await this.ingredientNames(ids);
    return {
      ...base,
      ingredients: comp.items.map((it) => ({
        ingredient_id: it.ingredientId,
        name: ingNames.get(it.ingredientId) ?? null,
        amount_kg: it.amount_kg,
        dm_kg: it.dm_kg,
        cp_kg: it.cp_kg,
        me_mj: it.me_mj,
        ndf_kg: it.ndf_kg,
        fat_kg: it.fat_kg,
        cost_tk: it.cost_tk,
      })),
    };
  }

  /** Effective (override-merged) ingredient nutrition/price by id, farm-scoped. */
  private async effectiveMap(
    farmId: string,
    ingredientIds: string[],
  ): Promise<Map<string, EffectiveIngredient>> {
    const ids = [...new Set(ingredientIds)];
    const [ingredients, overrides] = await Promise.all([
      this.prisma.feedIngredient.findMany({ where: { id: { in: ids } } }),
      this.prisma.feedIngredientOverride.findMany({
        where: { farmId, ingredientId: { in: ids } },
      }),
    ]);
    const ovById = new Map(overrides.map((o) => [o.ingredientId, o]));
    return new Map(
      ingredients.map((ing) => [
        ing.id,
        resolveEffective(ing, ovById.get(ing.id) ?? null),
      ]),
    );
  }

  private async ingredientNames(ids: string[]) {
    const rows = await this.prisma.feedIngredient.findMany({
      where: { id: { in: ids } },
      select: { id: true, nameEn: true },
    });
    return new Map(rows.map((r) => [r.id, r.nameEn]));
  }

  private async assertIngredients(ingredientIds: string[]) {
    const ids = [...new Set(ingredientIds)];
    const count = await this.prisma.feedIngredient.count({
      where: { id: { in: ids }, isActive: true },
    });
    if (count !== ids.length) {
      throw new BadRequestException('One or more ingredients are invalid');
    }
  }

  private async validateTargets(
    farmId: string,
    feedGroupId?: string,
    cattleId?: string,
  ) {
    if (feedGroupId) {
      const group = await this.prisma.feedGroup.findFirst({
        where: { id: feedGroupId, farmId },
        select: { id: true },
      });
      if (!group)
        throw new BadRequestException('Feed group must belong to the farm');
    }
    if (cattleId) {
      const cattle = await this.prisma.cattle.findFirst({
        where: { id: cattleId, farmId },
        select: { id: true },
      });
      if (!cattle)
        throw new BadRequestException('Cattle must belong to the farm');
    }
  }

  private async getOrThrow(
    farmId: string,
    id: string,
  ): Promise<ConcentrationWithItems> {
    const row = await this.prisma.feedConcentration.findFirst({
      where: { id, farmId, isActive: true },
      include: { items: true },
    });
    if (!row) throw new NotFoundException('Concentration template not found');
    return row;
  }

  private reqShape(req: Requirements) {
    return {
      dm_kg: req.dmKg,
      cp_kg: req.cpKg,
      me_mj: req.meMj,
      ndf_kg: req.ndfKg,
      fat_kg: req.fatKg,
    };
  }
}
