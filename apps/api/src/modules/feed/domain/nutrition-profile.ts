/**
 * Pure nutrition-profile rules (MILESTONE 26, RAKHAL-443, docs/EPIC_FEED_NUTRITION_PROFILE.md D4/D5/D9).
 * No framework/Prisma. Basis matches `ingredient-resolver.ts`: every `xPct` is % of dry matter except
 * `rdpPct`/`rupPct` (% of CP). `null` = not measured, never zero.
 */

export type NutritionSourceKind =
  | 'REFERENCE'
  | 'MANUFACTURER'
  | 'LAB'
  | 'FARM_ESTIMATE';

/** Required trio — feeding math is meaningless without them (D4). */
export const CORE_NUTRIENT_KEYS = ['dmPct', 'cpPct', 'meMjPerKgDm'] as const;

/** Optional nutrients — null means "not measured". */
export const OPTIONAL_NUTRIENT_KEYS = [
  'fatPct',
  'ndfPct',
  'adfPct',
  'rdpPct',
  'rupPct',
  'starchPct',
  'sugarsPct',
  'calciumPct',
  'phosphorusPct',
  'tdnPct',
] as const;

export const NUTRIENT_KEYS = [
  ...CORE_NUTRIENT_KEYS,
  ...OPTIONAL_NUTRIENT_KEYS,
] as const;

export type NutrientKey = (typeof NUTRIENT_KEYS)[number];

export interface NutritionValues {
  dmPct: number;
  cpPct: number;
  meMjPerKgDm: number;
  fatPct: number | null;
  ndfPct: number | null;
  adfPct: number | null;
  rdpPct: number | null;
  rupPct: number | null;
  starchPct: number | null;
  sugarsPct: number | null;
  calciumPct: number | null;
  phosphorusPct: number | null;
  tdnPct: number | null;
}

/** Highest plausible ME for a feed (pure fat is ~35 MJ/kg DM); guards an obvious unit slip (kcal, kJ). */
export const ME_MAX_MJ_PER_KG_DM = 40;
/** Proximate components are measured independently, so allow a little rounding overshoot. */
const SUM_TOLERANCE = 5;

/** Builds a complete value set from a partial one, defaulting every unmeasured optional to null. */
export function toNutritionValues(
  input: Partial<Record<NutrientKey, number | null | undefined>> &
    Pick<NutritionValues, 'dmPct' | 'cpPct' | 'meMjPerKgDm'>,
): NutritionValues {
  const out = {} as NutritionValues;
  for (const key of CORE_NUTRIENT_KEYS) out[key] = input[key];
  for (const key of OPTIONAL_NUTRIENT_KEYS) out[key] = input[key] ?? null;
  return out;
}

/**
 * Returns human-readable problems; empty array = valid. Rejects a typo like CP 200 or NDF < ADF *before*
 * it can distort live ration plans (D9).
 */
export function validateNutrition(v: NutritionValues): string[] {
  const problems: string[] = [];

  for (const key of NUTRIENT_KEYS) {
    const value = v[key];
    if (value === null) continue;
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      problems.push(`${key} must be a number`);
    }
  }
  if (problems.length > 0) return problems;

  if (v.dmPct <= 0 || v.dmPct > 100) {
    problems.push('dmPct must be greater than 0 and at most 100');
  }
  if (v.cpPct < 0 || v.cpPct > 100)
    problems.push('cpPct must be between 0 and 100');
  if (v.meMjPerKgDm < 0 || v.meMjPerKgDm > ME_MAX_MJ_PER_KG_DM) {
    problems.push(
      `meMjPerKgDm must be between 0 and ${ME_MAX_MJ_PER_KG_DM} MJ/kg DM`,
    );
  }
  for (const key of OPTIONAL_NUTRIENT_KEYS) {
    const value = v[key];
    if (value !== null && (value < 0 || value > 100)) {
      problems.push(`${key} must be between 0 and 100`);
    }
  }

  if (v.ndfPct !== null && v.adfPct !== null && v.ndfPct < v.adfPct) {
    problems.push('ndfPct must be at least adfPct (ADF is a subset of NDF)');
  }
  if (v.rdpPct !== null && v.rupPct !== null && v.rdpPct + v.rupPct > 100 + 1) {
    problems.push('rdpPct + rupPct cannot exceed 100 (both are % of CP)');
  }
  if (
    v.calciumPct !== null &&
    v.phosphorusPct !== null &&
    v.calciumPct + v.phosphorusPct > 100
  ) {
    problems.push('calciumPct + phosphorusPct cannot exceed 100');
  }
  const measured =
    v.cpPct + (v.fatPct ?? 0) + (v.ndfPct ?? 0) + (v.starchPct ?? 0);
  if (measured > 100 + SUM_TOLERANCE) {
    problems.push(
      'cpPct + fatPct + ndfPct + starchPct cannot exceed 100% of dry matter',
    );
  }

  return problems;
}

type CatalogueNutrients = Pick<
  NutritionValues,
  'dmPct' | 'cpPct' | 'meMjPerKgDm'
> &
  Partial<Record<(typeof OPTIONAL_NUTRIENT_KEYS)[number], number | null>>;

type OverrideNutrients = Partial<
  Record<`custom${Capitalize<NutrientKey>}`, number | null | undefined>
>;

/**
 * Null-preserving merge of a catalogue ingredient with a farm override (any custom field wins, null
 * falls through). Unlike `resolveEffective()` — which coerces a missing optional nutrient to 0 for
 * formula math — this keeps "not measured" as null, which is what a copied profile must record (D4).
 */
export function mergeCatalogueNutrition(
  ingredient: CatalogueNutrients,
  override?: OverrideNutrients | null,
): NutritionValues {
  const pick = (
    custom: number | null | undefined,
    standard: number | null | undefined,
  ): number | null => custom ?? standard ?? null;
  return {
    dmPct: pick(override?.customDmPct, ingredient.dmPct) as number,
    cpPct: pick(override?.customCpPct, ingredient.cpPct) as number,
    meMjPerKgDm: pick(
      override?.customMeMjPerKgDm,
      ingredient.meMjPerKgDm,
    ) as number,
    fatPct: pick(override?.customFatPct, ingredient.fatPct),
    ndfPct: pick(override?.customNdfPct, ingredient.ndfPct),
    adfPct: pick(override?.customAdfPct, ingredient.adfPct),
    rdpPct: pick(override?.customRdpPct, ingredient.rdpPct),
    rupPct: pick(override?.customRupPct, ingredient.rupPct),
    starchPct: pick(override?.customStarchPct, ingredient.starchPct),
    // The override table has no sugars column — catalogue value only.
    sugarsPct: ingredient.sugarsPct ?? null,
    calciumPct: pick(override?.customCalciumPct, ingredient.calciumPct),
    phosphorusPct: pick(
      override?.customPhosphorusPct,
      ingredient.phosphorusPct,
    ),
    tdnPct: pick(override?.customTdnPct, ingredient.tdnPct),
  };
}

/** Moisture is derived, never stored (D5). */
export const moisturePctFromDm = (dmPct: number): number =>
  Math.round((100 - dmPct) * 100) / 100;

/** Nutrient keys whose value differs between two sets (null and 0 are different). */
export function diffNutrition(
  a: NutritionValues,
  b: NutritionValues,
  epsilon = 1e-9,
): NutrientKey[] {
  return NUTRIENT_KEYS.filter((key) => {
    const x = a[key];
    const y = b[key];
    if (x === null || y === null) return x !== y;
    return Math.abs(x - y) > epsilon;
  });
}
