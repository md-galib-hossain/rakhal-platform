import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FeedConcentration,
  FeedConcentrationItem,
  FeedConcentrationKind,
} from '@prisma/client';
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
import { FeedStockService } from './feed-stock.service';

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
    private readonly feedStock: FeedStockService,
  ) {
    this.log = this.logger.setContext(FeedConcentrationService.name);
  }

  async list(farmId: string, kind?: FeedConcentrationKind) {
    const rows = await this.prisma.feedConcentration.findMany({
      where: { farmId, isActive: true, ...(kind ? { kind } : {}) },
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
    // Concentrate Mixer templates are recipes, not cow-targeted rations — force-null every target
    // field regardless of what the payload sent (belt-and-suspenders: the frontend form also never
    // shows these fields for this kind, but a template must never accidentally end up bucketed as a
    // Feed Mixture the way every concentration did before `kind` existed, user request 2026-07-18).
    const isTemplate = dto.kind === 'CONCENTRATE_TEMPLATE';
    if (
      !isTemplate &&
      (dto.targetWeightKg == null || dto.targetMilkL == null)
    ) {
      throw new BadRequestException(
        'A Feed Mixture requires targetWeightKg and targetMilkL',
      );
    }
    const targetType = isTemplate ? undefined : dto.targetType;
    const feedGroupId = isTemplate ? undefined : dto.feedGroupId;
    const cattleId = isTemplate ? undefined : dto.cattleId;
    const targetWeightKg = isTemplate ? undefined : dto.targetWeightKg;
    const targetMilkL = isTemplate ? undefined : dto.targetMilkL;

    await this.validateTargets(farmId, feedGroupId, cattleId);
    await this.assertIngredients(dto.items.map((i) => i.ingredientId));

    const created = await this.prisma.feedConcentration.create({
      data: {
        farmId,
        kind: dto.kind,
        name: dto.name,
        durationDays: dto.durationDays,
        targetType,
        feedGroupId,
        cattleId,
        targetWeightKg,
        targetMilkL,
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
    this.log.info('Feed concentration created', {
      farmId,
      id: created.id,
      kind: created.kind,
    });
    return this.enrich(farmId, created, true);
  }

  async update(farmId: string, id: string, dto: UpdateConcentrationDto) {
    const existing = await this.getOrThrow(farmId, id);
    // `kind` is immutable — a template can never pick up a target via edit either (same
    // defense-in-depth as `create`, see that method's comment).
    const isTemplate = existing.kind === 'CONCENTRATE_TEMPLATE';
    const targetType = isTemplate ? undefined : dto.targetType;
    const feedGroupId = isTemplate ? undefined : dto.feedGroupId;
    const cattleId = isTemplate ? undefined : dto.cattleId;
    const targetWeightKg = isTemplate ? undefined : dto.targetWeightKg;
    const targetMilkL = isTemplate ? undefined : dto.targetMilkL;

    await this.validateTargets(farmId, feedGroupId, cattleId);
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
          targetType,
          feedGroupId,
          cattleId,
          targetWeightKg,
          targetMilkL,
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

  /** Multi-select delete (user request 2026-07-18) — one `updateMany`, silently skipping any id
   * outside this farm or already inactive rather than erroring the whole batch. */
  async removeMany(farmId: string, ids: string[]) {
    const result = await this.prisma.feedConcentration.updateMany({
      where: { farmId, id: { in: ids }, isActive: true },
      data: { isActive: false },
    });
    this.log.info('Feed concentrations bulk-archived', {
      farmId,
      requested: ids.length,
      archived: result.count,
    });
    return { deleted: result.count };
  }

  /**
   * Promote this concentration into a reusable, **frozen** `FeedIngredient` row
   * (user request 2026-07-17, "concentrates become reusable ingredients" —
   * concentrate-as-ingredient + versioning). Computes the formula's current
   * totals, back-derives per-DM/per-CP nutrient rates onto a new ingredient row
   * (farm-scoped, `category: CONCENTRATE`), flips any prior promoted version's
   * `isLatestVersion` to `false`, and bumps this concentration's `versionNumber`.
   * The new row is never mutated again — a TMR that adds it as a line item keeps
   * resolving this exact snapshot even if the concentration is edited and
   * re-finalized later (see `FeedIngredient`'s Prisma doc comment).
   */
  async finalize(farmId: string, userId: string, id: string) {
    const row = await this.getOrThrow(farmId, id);
    if (row.kind !== 'CONCENTRATE_TEMPLATE') {
      throw new BadRequestException(
        'Only a Concentrate Mixer template can be finalized — a Feed Mixture is the final ration, not an intermediate recipe',
      );
    }
    if (row.items.length === 0) {
      throw new BadRequestException(
        'Cannot finalize an empty concentration — add ingredients first',
      );
    }

    const effById = await this.effectiveMap(
      farmId,
      row.items.map((i) => i.ingredientId),
    );
    const lines: FormulaLine[] = row.items.map((i) => ({
      ingredientId: i.ingredientId,
      amountKg: i.amountKg,
    }));
    const { totals } = computeTotals(lines, effById);
    const totalAsFedKg = row.items.reduce((sum, i) => sum + i.amountKg, 0);

    if (totalAsFedKg <= 0 || totals.dm_kg <= 0) {
      throw new BadRequestException(
        'Concentration has no measurable dry matter to promote',
      );
    }
    const pctOfDm = (kg: number) =>
      totals.dm_kg > 0 ? (kg / totals.dm_kg) * 100 : 0;
    const pctOfCp = (kg: number) =>
      totals.cp_kg > 0 ? (kg / totals.cp_kg) * 100 : 0;

    const version = row.versionNumber;
    const created = await this.prisma.$transaction(async (tx) => {
      await tx.feedIngredient.updateMany({
        where: { sourceConcentrationId: row.id, isLatestVersion: true },
        data: { isLatestVersion: false },
      });
      const ingredient = await tx.feedIngredient.create({
        data: {
          farmId,
          nameEn: `${row.name} (v${version})`,
          category: 'CONCENTRATE',
          dmPct: (totalAsFedKg > 0 ? totals.dm_kg / totalAsFedKg : 0) * 100,
          cpPct: pctOfDm(totals.cp_kg),
          meMjPerKgDm: totals.dm_kg > 0 ? totals.me_mj / totals.dm_kg : 0,
          fatPct: pctOfDm(totals.fat_kg),
          ndfPct: pctOfDm(totals.ndf_kg),
          rdpPct: pctOfCp(totals.rdp_kg),
          rupPct: pctOfCp(totals.rup_kg),
          starchPct: pctOfDm(totals.starch_kg),
          adfPct: pctOfDm(totals.adf_kg),
          calciumPct: pctOfDm(totals.calcium_kg),
          phosphorusPct: pctOfDm(totals.phosphorus_kg),
          tdnPct: pctOfDm(totals.tdn_kg),
          currentPricePerKg: totals.total_cost_tk / totalAsFedKg,
          isSystemDefault: false,
          isAvailableBd: true,
          sourceConcentrationId: row.id,
          sourceConcentrationVersion: version,
          isLatestVersion: true,
        },
      });
      await tx.feedConcentration.update({
        where: { id: row.id },
        data: { versionNumber: version + 1 },
      });
      return ingredient;
    });

    this.log.info('Feed concentration finalized into a reusable ingredient', {
      farmId,
      concentrationId: row.id,
      version,
      ingredientId: created.id,
      userId,
    });

    const stock = await this.feedStock.produceFromConcentration(
      farmId,
      userId,
      {
        concentrationId: row.id,
        version,
        qtyKg: totalAsFedKg,
        costTk: totals.total_cost_tk,
      },
    );

    return {
      concentration_id: row.id,
      version,
      stock,
      ingredient: {
        id: created.id,
        name_en: created.nameEn,
        is_custom: true,
        is_latest_version: created.isLatestVersion,
        source_concentration_id: created.sourceConcentrationId,
        source_concentration_version: created.sourceConcentrationVersion,
        effective_price_per_kg: created.currentPricePerKg,
        nutrition: {
          dm_pct: created.dmPct,
          cp_pct: created.cpPct,
          me_mj_per_kg_dm: created.meMjPerKgDm,
          fat_pct: created.fatPct,
          ndf_pct: created.ndfPct,
          rdp_pct: created.rdpPct,
          rup_pct: created.rupPct,
          starch_pct: created.starchPct,
          adf_pct: created.adfPct,
          calcium_pct: created.calciumPct,
          phosphorus_pct: created.phosphorusPct,
          tdn_pct: created.tdnPct,
        },
      },
    };
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
      kind: row.kind,
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
        rdp_kg: it.rdp_kg,
        rup_kg: it.rup_kg,
        starch_kg: it.starch_kg,
        adf_kg: it.adf_kg,
        calcium_kg: it.calcium_kg,
        phosphorus_kg: it.phosphorus_kg,
        tdn_kg: it.tdn_kg,
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
