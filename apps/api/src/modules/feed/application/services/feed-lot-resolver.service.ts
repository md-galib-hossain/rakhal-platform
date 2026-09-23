import { Injectable } from '@nestjs/common';
import { NutritionProfile } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import {
  EffectiveIngredient,
  resolveEffective,
} from '../../domain/ingredient-resolver';
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
