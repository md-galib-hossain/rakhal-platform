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
 * There is no separate "concentration template" vs "feed mixture" entity — Figma's two list
 * sections are the same `FeedConcentration` resource, split client-side (`feed-view.tsx`) by
 * whether `balance_score` is present (i.e. whether a target was set).
 */

export type FeedTargetType = "GROUP" | "INDIVIDUAL";
export type FeedIngredientCategory = "ROUGHAGE" | "CONCENTRATE" | "SILAGE" | "SUPPLEMENT" | "BY_PRODUCT";

export interface FeedIngredient {
  id: string;
  name_en: string;
  name_bn: string | null;
  category: FeedIngredientCategory;
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
  };
  override_notes: string | null;
}

export interface FeedRequirements {
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  ndf_kg: number;
  fat_kg: number;
}

export interface FeedRequirementsResult {
  inputs: { weight_kg: number; milk_target_l: number; milk_fat_pct: number };
  requirements: FeedRequirements;
}

export interface FeedFormulaTotals {
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  ndf_kg: number;
  fat_kg: number;
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
  cost_tk: number;
}

/** `GET /feed/concentrations` list row (not detailed — no `ingredients` line items). */
export interface FeedConcentrationSummary {
  id: string;
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
  name: string;
  durationDays?: number;
  targetType: FeedTargetType;
  feedGroupId?: string;
  cattleId?: string;
  targetWeightKg: number;
  targetMilkL: number;
  items: FeedConcentrationItemInput[];
}

export interface NormalizeConcentrationPayload {
  weightKg: number;
  milkTargetL: number;
  milkFatPct?: number;
  items: FeedConcentrationItemInput[];
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
