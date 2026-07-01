import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/core/database/prisma/prisma.service';
import { LoggerService } from 'src/core/logger/logger/logger.service';
import { resolveEffective } from '../../domain/ingredient-resolver';
import { SetFeedOverrideDto } from '../../presentation/dto/set-feed-override.dto';

/**
 * Feed ingredient catalogue + per-farm overrides (PRD §12.1 / §4.3, RAKHAL-080).
 * The catalogue is the seeded global `FeedIngredient` table (Rakhal-Admin proxy
 * until RAKHAL-110); farms layer price/nutrition overrides on top. The merged,
 * effective view is resolved by the pure `resolveEffective` domain helper.
 */
@Injectable()
export class FeedIngredientService {
  private readonly log: LoggerService;

  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: LoggerService,
  ) {
    this.log = this.logger.setContext(FeedIngredientService.name);
  }

  /** Merged ingredient list (Admin catalogue × this farm's overrides). */
  async listMerged(farmId: string) {
    const [ingredients, overrides] = await Promise.all([
      this.prisma.feedIngredient.findMany({
        where: { isActive: true },
        orderBy: [{ category: 'asc' }, { nameEn: 'asc' }],
      }),
      this.prisma.feedIngredientOverride.findMany({ where: { farmId } }),
    ]);
    const overrideByIngredient = new Map(
      overrides.map((o) => [o.ingredientId, o]),
    );

    return ingredients.map((ing) => {
      const override = overrideByIngredient.get(ing.id) ?? null;
      const eff = resolveEffective(ing, override);
      return {
        id: ing.id,
        name_en: ing.nameEn,
        name_bn: ing.nameBn,
        category: ing.category,
        nutrition_source: ing.nutritionSource,
        rakhal_price_per_kg: ing.currentPricePerKg,
        price_updated_at: ing.priceUpdatedAt,
        effective_price_per_kg: eff.pricePerKg,
        price_source: eff.priceSource,
        has_nutrition_override: eff.hasNutritionOverride,
        is_available_bd: ing.isAvailableBd,
        nutrition: {
          dm_pct: eff.dmPct,
          cp_pct: eff.cpPct,
          me_mj_per_kg_dm: eff.meMjPerKgDm,
          fat_pct: eff.fatPct,
          ndf_pct: eff.ndfPct,
        },
        override_notes: override?.notes ?? null,
      };
    });
  }

  /** Upsert this farm's override for an ingredient. */
  async setOverride(
    farmId: string,
    userId: string,
    ingredientId: string,
    dto: SetFeedOverrideDto,
  ) {
    await this.assertIngredientExists(ingredientId);
    const data = {
      customPricePerKg: dto.customPricePerKg ?? null,
      customDmPct: dto.customDmPct ?? null,
      customCpPct: dto.customCpPct ?? null,
      customMeMjPerKgDm: dto.customMeMjPerKgDm ?? null,
      customFatPct: dto.customFatPct ?? null,
      customNdfPct: dto.customNdfPct ?? null,
      notes: dto.notes ?? null,
    };
    const override = await this.prisma.feedIngredientOverride.upsert({
      where: { farmId_ingredientId: { farmId, ingredientId } },
      update: data,
      create: { farmId, ingredientId, createdBy: userId, ...data },
    });
    this.log.info('Feed ingredient override set', { farmId, ingredientId });
    return override;
  }

  /** Reset an ingredient to Rakhal Admin defaults (remove the farm override). */
  async resetOverride(farmId: string, ingredientId: string) {
    await this.prisma.feedIngredientOverride.deleteMany({
      where: { farmId, ingredientId },
    });
    this.log.info('Feed ingredient override reset', { farmId, ingredientId });
    return { ingredient_id: ingredientId, price_source: 'rakhal_market' };
  }

  private async assertIngredientExists(ingredientId: string) {
    const ing = await this.prisma.feedIngredient.findUnique({
      where: { id: ingredientId },
      select: { id: true },
    });
    if (!ing) {
      throw new BadRequestException('Ingredient not found');
    }
  }
}
