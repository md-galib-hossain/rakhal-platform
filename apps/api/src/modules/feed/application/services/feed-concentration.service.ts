import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  FeedConcentration,
  FeedConcentrationItem,
  FeedConcentrationKind,
  FeedIngredient,
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
  FormulaTotals,
  normalize,
} from '../../domain/formula-math';
import { computeRequirements, Requirements } from '../../domain/requirements';
import {
  CreateConcentrationDto,
  NormalizeConcentrationDto,
  UpdateConcentrationDto,
} from '../../presentation/dto/concentration.dto';
import { FeedStockService } from './feed-stock.service';
import { FeedRequirementsService } from './feed-requirements.service';

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
    private readonly feedRequirements: FeedRequirementsService,
  ) {
    this.log = this.logger.setContext(FeedConcentrationService.name);
  }

  async list(farmId: string, kind?: FeedConcentrationKind) {
    const rows = await this.prisma.feedConcentration.findMany({
      where: { farmId, isActive: true, ...(kind ? { kind } : {}) },
      orderBy: { createdAt: 'desc' },
      include: { items: true },
    });
    const finalizedIds = await this.finalizedIds(
      farmId,
      rows.map((r) => r.id),
    );
    return Promise.all(
      rows.map((r) => this.enrich(farmId, r, false, finalizedIds)),
    );
  }

  async get(farmId: string, id: string) {
    const row = await this.getOrThrow(farmId, id);
    const finalizedIds = await this.finalizedIds(farmId, [id]);
    return this.enrich(farmId, row, true, finalizedIds);
  }

  /** Which of these concentration ids have ever been finalized at least once — a `FeedStock` lot is
   * produced unconditionally on every `finalize()` call for both kinds (see that method's doc
   * comment), so its mere existence is a reliable, cheap "has this recipe ever been finalized"
   * signal for the card UI (user report 2026-07-19: Finalize was easy to miss, farmers had no way to
   * tell a template hadn't been made usable in a TMR yet). */
  private async finalizedIds(
    farmId: string,
    concentrationIds: string[],
  ): Promise<Set<string>> {
    if (concentrationIds.length === 0) return new Set();
    const rows = await this.prisma.feedStock.findMany({
      where: { farmId, sourceConcentrationId: { in: concentrationIds } },
      select: { sourceConcentrationId: true },
      distinct: ['sourceConcentrationId'],
    });
    return new Set(rows.map((r) => r.sourceConcentrationId));
  }

  async create(farmId: string, userId: string, dto: CreateConcentrationDto) {
    // Concentrate Mixer templates are recipes, not cow-targeted rations — force-null every target
    // field regardless of what the payload sent (belt-and-suspenders: the frontend form also never
    // shows these fields for this kind, but a template must never accidentally end up bucketed as a
    // Feed Mixture the way every concentration did before `kind` existed, user request 2026-07-18).
    const isTemplate = dto.kind === 'CONCENTRATE_TEMPLATE';
    if (!isTemplate && dto.durationDays == null) {
      throw new BadRequestException(
        'A Total Mixed Ration requires durationDays',
      );
    }
    const targetType = isTemplate ? undefined : dto.targetType;
    const feedGroupId = isTemplate ? undefined : dto.feedGroupId;
    const cattleId = isTemplate ? undefined : dto.cattleId;
    let targetWeightKg = isTemplate ? undefined : dto.targetWeightKg;
    let targetMilkL = isTemplate ? undefined : dto.targetMilkL;

    // Once a real cow/group target is picked, manual weight/milk entry is optional (user request
    // 2026-07-18) — the wizard already surfaces these live-derived values, so the backend must be
    // able to resolve them too instead of hard-rejecting whenever they're omitted. Reuses the exact
    // same cattle/group derivation `GET /feed/requirements` already exposes to the wizard's live
    // preview, so the stored value matches what the farmer actually saw on screen.
    if (!isTemplate && (targetWeightKg == null || targetMilkL == null)) {
      if (cattleId || feedGroupId) {
        const resolved = await this.feedRequirements.calc(farmId, {
          cattleId,
          feedGroupId,
          weightKg: targetWeightKg,
          milkTargetL: targetMilkL,
        });
        targetWeightKg ??= resolved.inputs.weight_kg;
        targetMilkL ??= resolved.inputs.milk_target_l;
      }
      if (targetWeightKg == null || targetMilkL == null) {
        throw new BadRequestException(
          'A Total Mixed Ration requires targetWeightKg and targetMilkL — supply them manually or target a cow/group with a real weight record',
        );
      }
    }

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

  /**
   * `kind` is immutable — a template can never pick up a target via edit either (same
   * defense-in-depth as `create`, see that method's comment). Live-sync (user request
   * 2026-07-18): if this template has already been finalized at least once, every save keeps its
   * promoted `FeedIngredient` in sync — no extra Finalize click needed for the change to reach
   * every TMR that already uses it. Never auto-promotes an ingredient that doesn't exist yet
   * (see `refreshPromotedIngredientIfExists`'s doc comment) — that stays a deliberate Finalize
   * action.
   */
  async update(farmId: string, id: string, dto: UpdateConcentrationDto) {
    const existing = await this.getOrThrow(farmId, id);
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

    if (isTemplate) {
      await this.refreshPromotedIngredientIfExists(farmId, updated);
    }

    this.log.info('Feed concentration updated', { farmId, id });
    return this.enrich(farmId, updated, true);
  }

  /** Archiving a concentration must also archive any `FeedIngredient` promoted from it
   * (`finalize()`'s `sourceConcentrationId`) — otherwise the ghost ingredient keeps passing
   * `listMerged`'s `isActive: true` filter and stays selectable in every ingredient picker
   * forever, even though the user believes they deleted it (user report 2026-07-18). */
  async remove(farmId: string, id: string) {
    await this.getOrThrow(farmId, id);
    await this.prisma.$transaction([
      this.prisma.feedConcentration.update({
        where: { id },
        data: { isActive: false },
      }),
      this.prisma.feedIngredient.updateMany({
        where: { sourceConcentrationId: id, isActive: true },
        data: { isActive: false },
      }),
    ]);
    this.log.info('Feed concentration archived', { farmId, id });
    return { id, archived: true };
  }

  /** Multi-select delete (user request 2026-07-18) — one `updateMany`, silently skipping any id
   * outside this farm or already inactive rather than erroring the whole batch. Also archives any
   * `FeedIngredient` promoted from these concentrations — see `remove()`'s doc comment. */
  async removeMany(farmId: string, ids: string[]) {
    const [result] = await this.prisma.$transaction([
      this.prisma.feedConcentration.updateMany({
        where: { farmId, id: { in: ids }, isActive: true },
        data: { isActive: false },
      }),
      this.prisma.feedIngredient.updateMany({
        where: { sourceConcentrationId: { in: ids }, isActive: true },
        data: { isActive: false },
      }),
    ]);
    this.log.info('Feed concentrations bulk-archived', {
      farmId,
      requested: ids.length,
      archived: result.count,
    });
    return { deleted: result.count };
  }

  /**
   * **Concentrate Mixer** (`kind=CONCENTRATE_TEMPLATE`): promote-or-refresh this concentration's
   * formula into a reusable `FeedIngredient` row — an **upsert by `sourceConcentrationId`**, not
   * "always create a new frozen version" (that versioning/freeze design was retired 2026-07-18 per
   * user request: editing the template must live-propagate to every TMR already using it, and
   * since a TMR's line item resolves nutrition via a live join on `ingredientId` — see
   * `effectiveMap()` — updating this one row in place is all propagation needs). **Total Mixed
   * Ration** (`kind=FEED_MIXTURE`): produces **only** a `FeedStock` inventory lot, no ingredient
   * promotion at all (user request 2026-07-18: a TMR is the final ration, never a building block
   * for another recipe). In both cases, producing a new physical stock batch stays a **deliberate,
   * unconditional action on every `finalize()` call** — only the ingredient-promotion half became
   * idempotent; a plain edit-save (`update()`) can refresh nutrition, but never produces stock.
   */
  async finalize(farmId: string, userId: string, id: string) {
    const row = await this.getOrThrow(farmId, id);
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

    let ingredientResult: ReturnType<typeof this.mapIngredient> | null = null;
    if (row.kind === 'CONCENTRATE_TEMPLATE') {
      const nutrition = this.buildIngredientNutrition(
        row.name,
        totals,
        totalAsFedKg,
      );
      const ingredient = await this.prisma.$transaction(async (tx) => {
        const existing = await tx.feedIngredient.findFirst({
          where: { sourceConcentrationId: row.id },
        });
        if (existing) {
          return tx.feedIngredient.update({
            where: { id: existing.id },
            data: { ...nutrition, isActive: true },
          });
        }
        return tx.feedIngredient.create({
          data: {
            farmId,
            ...nutrition,
            isSystemDefault: false,
            isAvailableBd: true,
            sourceConcentrationId: row.id,
            sourceConcentrationVersion: 1,
            isLatestVersion: true,
          },
        });
      });
      this.log.info(
        'Feed concentration promoted/refreshed into a reusable ingredient',
        {
          farmId,
          concentrationId: row.id,
          ingredientId: ingredient.id,
          userId,
        },
      );
      ingredientResult = this.mapIngredient(ingredient);
    }

    const stock = await this.feedStock.produceFromConcentration(
      farmId,
      userId,
      {
        concentrationId: row.id,
        version: 1,
        qtyKg: totalAsFedKg,
        costTk: totals.total_cost_tk,
      },
    );

    return {
      concentration_id: row.id,
      stock,
      ingredient: ingredientResult,
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
    finalizedIds?: Set<string>,
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
      is_finalized: finalizedIds?.has(row.id) ?? false,
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

  /** Back-derives per-DM/per-CP nutrient rates from a formula's computed totals onto the shape
   * `FeedIngredient` needs — shared by `finalize()` (first promotion / refresh-on-reFinalize) and
   * `refreshPromotedIngredientIfExists()` (live-sync on plain edit-save), so the two call sites
   * can never drift from each other. */
  private buildIngredientNutrition(
    name: string,
    totals: FormulaTotals,
    totalAsFedKg: number,
  ) {
    const pctOfDm = (kg: number) =>
      totals.dm_kg > 0 ? (kg / totals.dm_kg) * 100 : 0;
    const pctOfCp = (kg: number) =>
      totals.cp_kg > 0 ? (kg / totals.cp_kg) * 100 : 0;
    return {
      nameEn: name,
      category: 'CONCENTRATE' as const,
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
    };
  }

  private mapIngredient(ing: FeedIngredient) {
    return {
      id: ing.id,
      name_en: ing.nameEn,
      is_custom: true,
      is_latest_version: ing.isLatestVersion,
      source_concentration_id: ing.sourceConcentrationId,
      source_concentration_version: ing.sourceConcentrationVersion,
      effective_price_per_kg: ing.currentPricePerKg,
      nutrition: {
        dm_pct: ing.dmPct,
        cp_pct: ing.cpPct,
        me_mj_per_kg_dm: ing.meMjPerKgDm,
        fat_pct: ing.fatPct,
        ndf_pct: ing.ndfPct,
        rdp_pct: ing.rdpPct,
        rup_pct: ing.rupPct,
        starch_pct: ing.starchPct,
        adf_pct: ing.adfPct,
        calcium_pct: ing.calciumPct,
        phosphorus_pct: ing.phosphorusPct,
        tdn_pct: ing.tdnPct,
      },
    };
  }

  /** Live-sync half of the 2026-07-18 rework (see `update()`'s doc comment) — if this template has
   * already been finalized at least once (a `FeedIngredient` with matching `sourceConcentrationId`
   * exists), refresh its nutrition/price to match the just-saved formula. **Never creates one** —
   * a template that hasn't been finalized yet stays un-promoted until the farmer deliberately
   * clicks Finalize; a plain edit must not silently start affecting other formulas' ingredient
   * pickers or any TMR. No-ops (leaves the promoted ingredient as it was) if the edit left the
   * formula with no measurable dry matter — same guard `finalize()` itself uses — rather than
   * writing nonsensical zeroed-out nutrition onto a row that's still actively referenced. */
  private async refreshPromotedIngredientIfExists(
    farmId: string,
    row: ConcentrationWithItems,
  ) {
    const promoted = await this.prisma.feedIngredient.findFirst({
      where: { sourceConcentrationId: row.id },
    });
    if (!promoted) return;

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
    if (totalAsFedKg <= 0 || totals.dm_kg <= 0) return;

    const nutrition = this.buildIngredientNutrition(
      row.name,
      totals,
      totalAsFedKg,
    );
    await this.prisma.feedIngredient.update({
      where: { id: promoted.id },
      data: nutrition,
    });
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
