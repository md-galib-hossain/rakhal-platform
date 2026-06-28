/**
 * Effective-ingredient resolution (PRD §4.3 / §12.1, RAKHAL-080). Pure — merges
 * the Rakhaal-Admin catalogue values with a farm's per-org override: any custom
 * field wins, null falls through to the standard value. No framework/Prisma.
 */

export interface CatalogueIngredient {
  id: string;
  dmPct: number;
  cpPct: number;
  meMjPerKgDm: number;
  fatPct: number | null;
  ndfPct: number | null;
  currentPricePerKg: number;
}

export interface IngredientOverride {
  customPricePerKg: number | null;
  customDmPct: number | null;
  customCpPct: number | null;
  customMeMjPerKgDm: number | null;
  customFatPct: number | null;
  customNdfPct: number | null;
}

export type PriceSource = 'rakhaal_market' | 'farm_override';

export interface EffectiveIngredient {
  id: string;
  pricePerKg: number;
  priceSource: PriceSource;
  hasNutritionOverride: boolean;
  dmPct: number;
  cpPct: number;
  meMjPerKgDm: number;
  fatPct: number;
  ndfPct: number;
}

const pick = <T>(custom: T | null | undefined, standard: T): T =>
  custom === null || custom === undefined ? standard : custom;

export function resolveEffective(
  ingredient: CatalogueIngredient,
  override?: IngredientOverride | null,
): EffectiveIngredient {
  const hasNutritionOverride = Boolean(
    override &&
    (override.customDmPct !== null ||
      override.customCpPct !== null ||
      override.customMeMjPerKgDm !== null ||
      override.customFatPct !== null ||
      override.customNdfPct !== null),
  );
  const priceOverridden =
    override?.customPricePerKg !== null &&
    override?.customPricePerKg !== undefined;

  return {
    id: ingredient.id,
    pricePerKg: pick(override?.customPricePerKg, ingredient.currentPricePerKg),
    priceSource: priceOverridden ? 'farm_override' : 'rakhaal_market',
    hasNutritionOverride,
    dmPct: pick(override?.customDmPct, ingredient.dmPct),
    cpPct: pick(override?.customCpPct, ingredient.cpPct),
    meMjPerKgDm: pick(override?.customMeMjPerKgDm, ingredient.meMjPerKgDm),
    fatPct: pick(override?.customFatPct, ingredient.fatPct ?? 0),
    ndfPct: pick(override?.customNdfPct, ingredient.ndfPct ?? 0),
  };
}
