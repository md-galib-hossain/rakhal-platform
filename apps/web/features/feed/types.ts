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
 * "Concentrate Mixer" (`kind: 'CONCENTRATE_TEMPLATE'`) and "Total Mixed Ration (TMR)"
 * (`kind: 'FEED_MIXTURE'`) are still the same `FeedConcentration` resource, but as of 2026-07-18
 * `kind` is an explicit, immutable, server-enforced discriminator — not an inferred "does it have a
 * target" heuristic. A Concentrate Mixer never carries a target (server nulls them out even if sent)
 * and can be promoted into a reusable ingredient via `POST /concentrations/:id/finalize`; a TMR
 * always carries a target and is the thing actually fed to a cow/group. (User request 2026-07-18
 * follow-up: standardized on "Concentrate Mixer"/"Total Mixed Ration (TMR)" everywhere — dialog
 * titles, confirmations, toasts — after these two names had drifted inconsistently across the UI.)
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
  /** Has this recipe ever been finalized (Finalize produces a `FeedStock` lot unconditionally for
   * both kinds — its existence is what this reflects). A never-finalized Concentrate Mixer can't be
   * picked in any TMR's ingredient picker yet; a never-finalized TMR has no inventory batch to feed
   * from. */
  is_finalized: boolean;
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

/** `targetWeightKg`/`targetMilkL` are optional as of Phase 12.3 (2026-07-18) — once a real
 * `feedGroupId`/`cattleId` target is set, the backend resolves both from that target's own
 * weight/milk records when omitted (same derivation `GET /feed/requirements` already exposes for
 * the wizard's live preview); they stay available as a manual override/fallback. */
export interface CreateFeedConcentrationPayload {
  kind: FeedConcentrationKind;
  name: string;
  durationDays?: number;
  targetType: FeedTargetType;
  feedGroupId?: string;
  cattleId?: string;
  targetWeightKg?: number;
  targetMilkL?: number;
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

/** `POST /feed/concentrations/:id/finalize` response. As of Phase 12.1/12.2 (2026-07-18):
 * `finalize()` is an upsert (no more `version` field — the promoted ingredient is kept in sync in
 * place, not versioned) and `ingredient` is `null` for a `FEED_MIXTURE` (a TMR produces stock only,
 * never a reusable ingredient — see the backend's `finalize()` doc comment). Only the fields the
 * frontend actually reads are typed here. */
export interface FinalizeConcentrationResult {
  concentration_id: string;
  stock: FeedStock;
  ingredient: { id: string; name_en: string } | null;
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

/** `FeedStockService.mapStock` — one physical batch produced by finalizing a Concentrate Mixer or
 * TMR (`sourceConcentrationId` points at whichever produced it). Phase 12.4 (2026-07-18) frontend —
 * the backend has had this since Phase 4, this is the first frontend type/consumer for it. */
export interface FeedStock {
  id: string;
  source_concentration_id: string;
  source_concentration_version: number;
  produced_at: string;
  produced_qty_kg: number;
  current_stock_kg: number;
  produced_cost_tk: number;
  created_at: string;
}

export interface FeedStockMovement {
  id: string;
  change_kg: number;
  reason: "PRODUCED" | "FED" | "ADJUSTMENT";
  distribution_id: string | null;
  created_at: string;
}

export interface FeedStockDetail extends FeedStock {
  movements: FeedStockMovement[];
}

/** `POST /feed/distributions` — "Feed Today" (Phase 12.4, 2026-07-18). The target (group vs one
 * cow) is never supplied directly — it's derived server-side from `concentrationId`'s own
 * `targetType`, matching how a TMR is already either GROUP- or INDIVIDUAL-targeted from creation. */
export interface LogDistributionItemInput {
  ingredientId: string;
  actualKg?: number;
  refusalKg?: number;
  stockId?: string;
}

export interface LogDistributionPayload {
  concentrationId: string;
  items?: LogDistributionItemInput[];
  distributedAt?: string;
  notes?: string;
}

export interface FeedDistributionItemLine {
  ingredient_id: string;
  name: string;
  planned_kg: number;
  actual_kg: number;
  refusal_kg: number;
  price_per_kg: number;
  line_cost: number;
}

export interface FeedDistribution {
  id: string;
  concentration_id: string;
  feed_group_id: string | null;
  cattle_id: string | null;
  distributed_at: string;
  total_planned_kg: number;
  total_actual_kg: number;
  total_refusal_kg: number;
  total_planned_cost: number;
  total_actual_cost: number;
  notes: string | null;
  forage_decrements: number | null;
  items: FeedDistributionItemLine[];
  created_at: string;
}

export interface FeedDistributionSummary {
  id: string;
  concentration_id: string;
  feed_group_id: string | null;
  cattle_id: string | null;
  distributed_at: string;
  total_actual_kg: number;
  total_actual_cost: number;
  created_at: string;
}

/** `GET /feed/efficiency` — planned-vs-actual + feed cost/litre for exactly one of a group or a
 * single cow (`feedGroupId` XOR `cattleId`, Phase 12.4 2026-07-18 added the `cattleId` mode). */
export interface FeedEfficiencyResult {
  feed_group_id: string | null;
  feed_group_name: string | null;
  cattle_id: string | null;
  cattle_name: string | null;
  period: string;
  distributions: number;
  group_cattle?: number;
  planned_kg: number;
  actual_kg: number;
  refusal_kg: number;
  consumed_kg: number;
  planned_cost: number;
  actual_cost: number;
  adherence_pct: number | null;
  refusal_pct: number | null;
  litres_produced: number;
  feed_cost_per_litre: number | null;
}
