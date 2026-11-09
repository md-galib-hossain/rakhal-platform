import { NutritionProfile } from '@prisma/client';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { EffectiveIngredient } from '../../domain/ingredient-resolver';
import { RecipeLineRef } from '../../domain/recipe-line';
import { NutritionValues } from '../../domain/nutrition-profile';
export declare class FeedLotResolver {
    private readonly prisma;
    constructor(prisma: PrismaService);
    effectiveIngredients(farmId: string, ingredientIds: string[]): Promise<Map<string, EffectiveIngredient>>;
    effectiveLines(farmId: string, lines: RecipeLineRef[]): Promise<Map<string, EffectiveIngredient>>;
    lineNames(farmId: string, lines: RecipeLineRef[]): Promise<Map<string, string>>;
    catalogueValues(farmId: string, ingredientId: string): Promise<{
        values: NutritionValues;
        nutritionSource: EffectiveIngredient['nutritionSource'];
    } | null>;
    profiles(farmId: string, profileIds: string[]): Promise<Map<string, NutritionProfile>>;
    batchProfile(farmId: string, batchId: string): Promise<NutritionProfile | null>;
    toValues(profile: NutritionProfile): NutritionValues;
}
