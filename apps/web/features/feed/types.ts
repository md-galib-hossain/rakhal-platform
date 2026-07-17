/**
 * Feed Formulator types — matched directly to `feed.controller.ts`/`feed-*.service.ts` response
 * shapes (Repos/rakhal-backend), which are genuinely **snake_case** (unlike every other module's
 * camelCase JSON) per those services' own "matches API §8" doc comments — not a typo carried over
 * from this file.
 *
 * Real gap vs the Figma "Feed Formulator" list frame (`1048:33190`), flagged not fabricated: the
 * mock's per-card "Weight Range (kg)" / "Avg. Daily Milk Yield (L)" stat boxes show a *range*
 * (e.g. "400-500"), but `FeedConcentration` only stores a single `target_weight_kg`/`target_milk_l`
 * point value (the one figure used to compute `requirements`/`balance_score`) — no min/max range
 * exists anywhere in the schema. Rendered honestly as "Target Weight (kg)"/"Target Milk (L/day)"
 * single values instead of inventing a range. "Number of Cow" *is* real, sourced from
 * `GET /settings/feed-groups`'s `assigned_count` for the concentration's `feed_group_id` (1 for an
 * `INDIVIDUAL`-target concentration).
 *
 * "Concentrate Mixer" (`kind: 'CONCENTRATE_TEMPLATE'`) and "Feed Mixture" (`kind: 'FEED_MIXTURE'`)
 * are still the same `FeedConcentration` resource, but as of 2026-07-18 `kind` is an explicit,
 * immutable, server-enforced discriminator — not an inferred "does it have a target" heuristic.
 * A template never carries a target (server nulls them out even if sent) and can be promoted into a
 * reusable ingredient via `POST /concentrations/:id/finalize`; a mixture always carries a target and
 * is the thing actually fed to a cow/group.
 */

export type FeedTargetType = "GROUP" | "INDIVIDUAL";
/** See this file's top-of-file doc comment — explicit, immutable, server-enforced. */
export type FeedConcentrationKind = "CONCENTRATE_TEMPLATE" | "FEED_MIXTURE";
export type FeedIngredientCategory = "ROUGHAGE" | "CONCENTRATE" | "SILAGE" | "SUPPLEMENT" | "BY_PRODUCT";
/** Display-only tag for a farm's quick-add custom ingredient — which of the ingredient table's 3
 * column groups to color it under. Doesn't feed any formula math (unlike `nutrition.*`). */
export type FeedNutrientGroup = "PROTEIN" | "ENERGY" | "FIBER";

export interface FeedIngredient {
  id: string;
  name_en: string;
  name_bn: string | null;
  category: FeedIngredientCategory;
  /** Set only for a farm's own quick-add ingredient (`is_custom: true`) — null for the Admin catalogue. */
  nutrient_group: FeedNutrientGroup | null;
  /** True for a farm-created ingredient (`POST /feed/ingredients/custom`) — invisible to other farms. */
  is_custom: boolean;
  nutrition_source: string | null;
  rakhal_price_per_kg: number;
  price_updated_at: string | null;
  effective_price_per_kg: number;
  price_source: string;
  has_nutrition_override: boolean;
  is_available_bd: boolean;
  nutrition: {
    dm_pct: number;
    cp_pct: number;
    me_mj_per_kg_dm: number;
    fat_pct: number | null;
    ndf_pct: number | null;
    /** % of CP, not % of DM (NRC/INRA convention — see backend `FeedIngredient` doc comment). */
    rdp_pct: number | null;
    /** % of CP, not % of DM. */
    rup_pct: number | null;
    starch_pct: number | null;
    adf_pct: number | null;
    calcium_pct: number | null;
    phosphorus_pct: number | null;
    tdn_pct: number | null;
  };
  override_notes: string | null;
}

/** `POST /feed/ingredients/custom` — a farm's own ingredient. `name`/`pricePerKg` are the only
 * required fields (quick-add — no nutrition breakdown, backend defaults `dmPct` to 100 and every
 * other nutrient to 0, so the line contributes real ৳ cost but 0 nutrients until a profile is
 * supplied). `nutrientGroup` is optional and no longer collected by the quick-add form (user
 * request 2026-07-17 — it was a display-only Protein/Energy/Fiber tag nothing in the UI actually
 * renders, so a farm had no way to answer it meaningfully). Every nutrition field below is optional
 * on top of that — a farm with real lab values (e.g. a feed-bag label) can fill in the "Advanced"
 * section of the quick-add form and this ingredient is then used exactly like a catalogue
 * ingredient everywhere downstream (formula totals, balance score inputs, later reuse). rdp/rup
 * are % of CP, everything else % of DM. */
export interface CreateCustomIngredientPayload {
  name: string;
  nutrientGroup?: FeedNutrientGroup;
  pricePerKg: number;
  dmPct?: number;
  cpPct?: number;
  meMjPerKgDm?: number;
  fatPct?: number;
  ndfPct?: number;
  rdpPct?: number;
  rupPct?: number;
  starchPct?: number;
  adfPct?: number;
  calciumPct?: number;
  phosphorusPct?: number;
  tdnPct?: number;
}

export interface FeedRequirements {
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  ndf_kg: number;
  fat_kg: number;
}

/** `GET /feed/requirements` — shape varies by mode (`FeedRequirementsService.calc`): manual/`cattleId`
 * modes return a flat `requirements`; `feedGroupId` mode returns `per_cow`/`group_total` instead (no
 * single `requirements` key) since a group has both a per-animal figure and a batch-sizing total.
 * `data_source` (added 2026-07-18 for the standalone nutrition calculator, user request — "help the
 * farmer track... how much comes from real cattle records vs a manual guess") flags whether each of
 * weight/milk-yield came from a real record, a 7-day milk-log average, a manual override, or
 * (cattle/group mode only, no manual fallback given) an assumed zero. */
export interface FeedRequirementsResult {
  inputs: {
    weight_kg: number;
    milk_target_l: number;
    milk_fat_pct: number;
    gestation_days?: number | null;
    bcs?: number | null;
    headcount?: number;
    cattle_with_weight?: number;
    cattle_with_milk_data?: number;
  };
  data_source?: { weight: string; milk_yield: string };
  requirements?: FeedRequirements;
  per_cow?: FeedRequirements;
  group_total?: FeedRequirements;
}

export interface FeedFormulaTotals {
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  ndf_kg: number;
  fat_kg: number;
  rdp_kg: number;
  rup_kg: number;
  starch_kg: number;
  adf_kg: number;
  calcium_kg: number;
  phosphorus_kg: number;
  tdn_kg: number;
  total_cost_tk: number;
}

export interface FeedConcentrationIngredientLine {
  ingredient_id: string;
  name: string | null;
  amount_kg: number;
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  ndf_kg: number;
  fat_kg: number;
  rdp_kg: number;
  rup_kg: number;
  starch_kg: number;
  adf_kg: number;
  calcium_kg: number;
  phosphorus_kg: number;
  tdn_kg: number;
  cost_tk: number;
}

/** `GET /feed/concentrations` list row (not detailed — no `ingredients` line items). */
export interface FeedConcentrationSummary {
  id: string;
  kind: FeedConcentrationKind;
  name: string;
  target_type: FeedTargetType;
  feed_group_id: string | null;
  cattle_id: string | null;
  duration_days: number | null;
  target_weight_kg: number | null;
  target_milk_l: number | null;
  totals: FeedFormulaTotals;
  balance_score: number | null;
  requirements: FeedRequirements | null;
  created_at: string;
}

/** `GET /feed/concentrations/:id` / create / update — adds the ingredient line items. */
export interface FeedConcentrationDetail extends FeedConcentrationSummary {
  ingredients: FeedConcentrationIngredientLine[];
}

export interface FeedConcentrationItemInput {
  ingredientId: string;
  amountKg: number;
}

export interface CreateFeedConcentrationPayload {
  kind: FeedConcentrationKind;
  name: string;
  durationDays?: number;
  targetType: FeedTargetType;
  feedGroupId?: string;
  cattleId?: string;
  targetWeightKg: number;
  targetMilkL: number;
  items: FeedConcentrationItemInput[];
}

/** `PATCH /feed/concentrations/:id` — every field optional (partial update); `items`, if present,
 * wholesale-replaces the existing lines (matches `UpdateConcentrationDto`'s doc comment). */
export interface UpdateFeedConcentrationPayload {
  name?: string;
  durationDays?: number;
  targetType?: FeedTargetType;
  feedGroupId?: string;
  cattleId?: string;
  targetWeightKg?: number;
  targetMilkL?: number;
  items?: FeedConcentrationItemInput[];
}

export interface NormalizeConcentrationPayload {
  weightKg: number;
  milkTargetL: number;
  milkFatPct?: number;
  items: FeedConcentrationItemInput[];
}

/** `POST /feed/concentrations/:id/finalize` response — promotes a Concentrate Mixer template into a
 * reusable, versioned `FeedIngredient` (and a `FeedStock` batch). Only the fields the frontend
 * actually reads are typed here; see the backend's `FeedConcentrationService.finalize` doc comment
 * for the full shape. */
export interface FinalizeConcentrationResult {
  concentration_id: string;
  version: number;
  ingredient: { id: string; name_en: string };
}

/** `POST /feed/concentrations/bulk-delete` — multi-select delete (user request 2026-07-18). */
export interface BulkDeleteConcentrationPayload {
  ids: string[];
}

export interface NormalizeConcentrationResult {
  requirements: FeedRequirements;
  items: { ingredient_id: string; amount_kg: number }[];
  totals: FeedFormulaTotals;
  balance_score: number;
}

/** `GET /settings/feed-groups` — owned by the Settings module, not Feed; used here read-only to
 * populate the "Select Group" picker + each card's real "Number of Cow" count. */
export interface FeedGroup {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  assigned_count: number;
  created_at: string;
}
