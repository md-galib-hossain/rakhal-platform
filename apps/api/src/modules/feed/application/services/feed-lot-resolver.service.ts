import { Injectable } from '@nestjs/common';
import { NutritionProfile } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  EffectiveIngredient,
  resolveEffective,
} from '../../domain/ingredient-resolver';
import { resolveKgPerUnit } from 'src/modules/inventory/application/services/unit.service';
import { isLotBacked, lineKey, RecipeLineRef } from '../../domain/recipe-line';
import {
  mergeCatalogueNutrition,
  NUTRIENT_KEYS,
  NutritionValues,
} from '../../domain/nutrition-profile';

/**
 * The one place nutrition is resolved (MILESTONE 26, RAKHAL-443, ADR-026). Replaces the two private
 * `effectiveMap()` copies `FeedDistributionService` and `FeedConcentrationService` each carried, and is
 * where purchased-feed lots (`FeedItemBatch` → `NutritionProfile`) meet catalogue ingredients. Read-only.
 *
 * Nothing here filters `deletedAt` on ingredients: ids come from saved recipe lines / historical
 * distributions, which must keep resolving even after an ingredient is archived (RAKHAL-310).
 */
@Injectable()
export class FeedLotResolver {
  constructor(private readonly prisma: PrismaService) {}

  /** Effective (override-merged) ingredient nutrition/price by id, farm-scoped. Formula-math shape
   * (`?? 0` coercion for unmeasured optionals — see `resolveEffective`). */
  async effectiveIngredients(
    farmId: string,
    ingredientIds: string[],
  ): Promise<Map<string, EffectiveIngredient>> {
    const ids = [...new Set(ingredientIds)];
    if (ids.length === 0) return new Map();
    const [ingredients, overrides] = await Promise.all([
      this.prisma.feedIngredient.findMany({ where: { id: { in: ids } } }),
      this.prisma.feedIngredientOverride.findMany({
        where: { farmId, ingredientId: { in: ids } },
      }),
    ]);
    const overrideById = new Map(overrides.map((o) => [o.ingredientId, o]));
    return new Map(
      ingredients.map((ing) => [
        ing.id,
        resolveEffective(ing, overrideById.get(ing.id) ?? null),
      ]),
    );
  }

  /**
   * RAKHAL-447 (D7): effective nutrition + price for recipe lines, keyed by `lineKey`. A line backed by
   * an inventory product takes the profile and cost of its pinned lot, else the FIFO head (the lot the
   * next feeding would draw; the newest lot when the shelf is empty). Every other line resolves through
   * the catalogue exactly as before.
   */
  async effectiveLines(
    farmId: string,
    lines: RecipeLineRef[],
  ): Promise<Map<string, EffectiveIngredient>> {
    const out = new Map<string, EffectiveIngredient>();
    const catalogueIds = lines
      .filter((l) => !isLotBacked(l) && l.ingredientId)
      .map((l) => l.ingredientId as string);
    const catalogue = await this.effectiveIngredients(farmId, catalogueIds);
    for (const l of lines) {
      if (!isLotBacked(l) && l.ingredientId) {
        const eff = catalogue.get(l.ingredientId);
        if (eff) out.set(lineKey(l), eff);
      }
    }

    const lotLines = lines.filter(isLotBacked);
    if (lotLines.length === 0) return out;
    const items = await this.prisma.feedItem.findMany({
      where: {
        farmId,
        id: { in: [...new Set(lotLines.map((l) => l.feedItemId as string))] },
      },
      include: {
        unit: true,
        batches: {
          where: { deletedAt: null },
          orderBy: [{ purchaseDate: 'asc' }, { createdAt: 'asc' }],
          include: { nutritionProfile: true },
        },
      },
    });
    const byId = new Map(items.map((i) => [i.id, i]));
    for (const l of lotLines) {
      const item = byId.get(l.feedItemId as string);
      if (!item) continue;
      const batch = l.feedItemBatchId
        ? item.batches.find((b) => b.id === l.feedItemBatchId)
        : (item.batches.find((b) => b.currentStock > 0) ??
          item.batches[item.batches.length - 1]);
      if (!batch) continue;
      const kgPerUnit = resolveKgPerUnit(item.unit, item.kgPerUnit);
      const p = batch.nutritionProfile;
      out.set(lineKey(l), {
        id: lineKey(l),
        pricePerKg:
          kgPerUnit && kgPerUnit > 0 ? batch.costPerUnit / kgPerUnit : 0,
        priceSource: 'farm_override',
        hasNutritionOverride: false,
        dmPct: p.dmPct,
        cpPct: p.cpPct,
        meMjPerKgDm: p.meMjPerKgDm,
        fatPct: p.fatPct ?? 0,
        ndfPct: p.ndfPct ?? 0,
        rdpPct: p.rdpPct ?? 0,
        rupPct: p.rupPct ?? 0,
        starchPct: p.starchPct ?? 0,
        adfPct: p.adfPct ?? 0,
        calciumPct: p.calciumPct ?? 0,
        phosphorusPct: p.phosphorusPct ?? 0,
        tdnPct: p.tdnPct ?? 0,
        nutritionSource: p.nutritionSource,
      });
    }
    return out;
  }

  /** Display names for recipe lines, keyed by `lineKey` (product name for lot-backed lines). */
  async lineNames(
    farmId: string,
    lines: RecipeLineRef[],
  ): Promise<Map<string, string>> {
    const out = new Map<string, string>();
    const ingredientIds = lines
      .filter((l) => !isLotBacked(l) && l.ingredientId)
      .map((l) => l.ingredientId as string);
    const itemIds = lines
      .filter(isLotBacked)
      .map((l) => l.feedItemId as string);
    const [ingredients, items]: [
      { id: string; nameEn: string }[],
      { id: string; name: string }[],
    ] = await Promise.all([
      ingredientIds.length
        ? this.prisma.feedIngredient.findMany({
            where: { id: { in: [...new Set(ingredientIds)] } },
            select: { id: true, nameEn: true },
          })
        : [],
      itemIds.length
        ? this.prisma.feedItem.findMany({
            where: { farmId, id: { in: [...new Set(itemIds)] } },
            select: { id: true, name: true },
          })
        : [],
    ]);
    const ingName = new Map(ingredients.map((i) => [i.id, i.nameEn]));
    const itemName = new Map(items.map((i) => [i.id, i.name]));
    for (const l of lines) {
      const name = isLotBacked(l)
        ? itemName.get(l.feedItemId as string)
        : ingName.get(l.ingredientId as string);
      if (name) out.set(lineKey(l), name);
    }
    return out;
  }

  /** Null-preserving catalogue values for one ingredient (what a "copy from catalogue" records and
   * what "differs from catalogue" compares against). Null when the ingredient does not exist. */
  async catalogueValues(
    farmId: string,
    ingredientId: string,
  ): Promise<{
    values: NutritionValues;
    nutritionSource: EffectiveIngredient['nutritionSource'];
  } | null> {
    const ingredient = await this.prisma.feedIngredient.findUnique({
      where: { id: ingredientId },
    });
    if (!ingredient) return null;
    const override = await this.prisma.feedIngredientOverride.findUnique({
      where: { farmId_ingredientId: { farmId, ingredientId } },
    });
    return {
      values: mergeCatalogueNutrition(ingredient, override),
      nutritionSource: resolveEffective(ingredient, override).nutritionSource,
    };
  }

  /** Immutable profile rows by id (farm-scoped — a profile from another farm resolves to nothing). */
  async profiles(
    farmId: string,
    profileIds: string[],
  ): Promise<Map<string, NutritionProfile>> {
    const ids = [...new Set(profileIds)];
    if (ids.length === 0) return new Map();
    const rows = await this.prisma.nutritionProfile.findMany({
      where: { id: { in: ids }, farmId },
    });
    return new Map(rows.map((r) => [r.id, r]));
  }

  /** The profile that nutrition-of-record for a purchased-feed lot comes from. */
  async batchProfile(
    farmId: string,
    batchId: string,
  ): Promise<NutritionProfile | null> {
    const batch = await this.prisma.feedItemBatch.findFirst({
      where: { id: batchId, farmId },
      include: { nutritionProfile: true },
    });
    return batch?.nutritionProfile ?? null;
  }

  /** Flattens a stored profile row to the value shape used by validation/diff/snapshots. */
  toValues(profile: NutritionProfile): NutritionValues {
    const values = {} as NutritionValues;
    for (const key of NUTRIENT_KEYS) {
      (values as unknown as Record<string, number | null>)[key] = profile[key];
    }
    return values;
  }
}
