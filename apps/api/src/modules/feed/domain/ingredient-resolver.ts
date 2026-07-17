/**
 * Effective-ingredient resolution (PRD §4.3 / §12.1, RAKHAL-080). Pure — merges
 * the Rakhal-Admin catalogue values with a farm's per-org override: any custom
 * field wins, null falls through to the standard value. No framework/Prisma.
 *
 * Nutrient basis (matches `feed.prisma`'s `FeedIngredient` doc comment): every
 * `xPct` is % of dry matter EXCEPT `rdpPct`/`rupPct`, which are % of crude
 * protein (NRC/INRA convention) — `formula-math.ts` computes their kg
 * contribution off `cp_kg`, not `dm_kg`. Never blur the two bases.
 */

export interface CatalogueIngredient {
  id: string;
  dmPct: number;
  cpPct: number;
  meMjPerKgDm: number;
  fatPct: number | null;
  ndfPct: number | null;
  rdpPct: number | null;
  rupPct: number | null;
  starchPct: number | null;
  adfPct: number | null;
  calciumPct: number | null;
  phosphorusPct: number | null;
  tdnPct: number | null;
  currentPricePerKg: number;
}

export interface IngredientOverride {
  customPricePerKg: number | null;
  customDmPct: number | null;
  customCpPct: number | null;
  customMeMjPerKgDm: number | null;
  customFatPct: number | null;
  customNdfPct: number | null;
  customRdpPct: number | null;
  customRupPct: number | null;
  customStarchPct: number | null;
  customAdfPct: number | null;
  customCalciumPct: number | null;
  customPhosphorusPct: number | null;
  customTdnPct: number | null;
}

export type PriceSource = 'rakhal_market' | 'farm_override';

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
  rdpPct: number;
  rupPct: number;
  starchPct: number;
  adfPct: number;
  calciumPct: number;
  phosphorusPct: number;
  tdnPct: number;
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
      override.customNdfPct !== null ||
      override.customRdpPct !== null ||
      override.customRupPct !== null ||
      override.customStarchPct !== null ||
      override.customAdfPct !== null ||
      override.customCalciumPct !== null ||
      override.customPhosphorusPct !== null ||
      override.customTdnPct !== null),
  );
  const priceOverridden =
    override?.customPricePerKg !== null &&
    override?.customPricePerKg !== undefined;

  return {
    id: ingredient.id,
    pricePerKg: pick(override?.customPricePerKg, ingredient.currentPricePerKg),
    priceSource: priceOverridden ? 'farm_override' : 'rakhal_market',
    hasNutritionOverride,
    dmPct: pick(override?.customDmPct, ingredient.dmPct),
    cpPct: pick(override?.customCpPct, ingredient.cpPct),
    meMjPerKgDm: pick(override?.customMeMjPerKgDm, ingredient.meMjPerKgDm),
    fatPct: pick(override?.customFatPct, ingredient.fatPct ?? 0),
    ndfPct: pick(override?.customNdfPct, ingredient.ndfPct ?? 0),
    rdpPct: pick(override?.customRdpPct, ingredient.rdpPct ?? 0),
    rupPct: pick(override?.customRupPct, ingredient.rupPct ?? 0),
    starchPct: pick(override?.customStarchPct, ingredient.starchPct ?? 0),
    adfPct: pick(override?.customAdfPct, ingredient.adfPct ?? 0),
    calciumPct: pick(override?.customCalciumPct, ingredient.calciumPct ?? 0),
    phosphorusPct: pick(
      override?.customPhosphorusPct,
      ingredient.phosphorusPct ?? 0,
    ),
    tdnPct: pick(override?.customTdnPct, ingredient.tdnPct ?? 0),
  };
}
