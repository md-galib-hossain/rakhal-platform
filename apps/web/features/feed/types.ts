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
 * 1 for an `INDIVIDUAL`-target concentration (not shown for a whole-herd one).
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

/** `HERD` is the whole-herd default ration, fallen through to when a cow has no INDIVIDUAL
 * override ("herd default -> individual override, most specific wins"). */
export type FeedTargetType = "INDIVIDUAL" | "HERD";
/** See this file's top-of-file doc comment — explicit, immutable, server-enforced. */
export type FeedConcentrationKind = "CONCENTRATE_TEMPLATE" | "FEED_MIXTURE";
/** Feed is the umbrella term; `FeedClass` is its scientific class (replaces the old
 * `FeedIngredientCategory`, which named forage/silage as separate categories from feed rather than
 * classes within it — `feed_taxonomy_unification`). `FeedSubType` is the optional operational
 * detail (silage vs hay vs straw are all FORAGE, grain vs oilcake vs by-product are all CONCENTRATE). */
export type FeedClass = "FORAGE" | "CONCENTRATE" | "MINERAL" | "VITAMIN" | "ADDITIVE" | "OTHER";
export type FeedSubType =
  | "GREEN_FODDER"
  | "ROUGHAGE"
  | "SILAGE"
  | "HAY"
  | "STRAW"
  | "GRAIN"
  | "OILCAKE"
  | "BY_PRODUCT"
  | "COMPOUND_PELLET"
  | "PREMIX"
  | "SUPPLEMENT"
  | "OTHER";
/** Display-only tag for a farm's quick-add custom ingredient — which of the ingredient table's 3
 * column groups to color it under. Doesn't feed any formula math (unlike `nutrition.*`). */
export type FeedNutrientGroup = "PROTEIN" | "ENERGY" | "FIBER";

export interface FeedIngredient {
  id: string;
  name_en: string;
  name_bn: string | null;
  feed_class: FeedClass;
  feed_sub_type: FeedSubType | null;
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

/** `GET /feed/ingredients/paged` query — cursor pagination (`limit`/`cursor`/`sortOrder`) plus
 * search/class/price-range filters, mirroring Inventory's `FeedItemListFilters` pattern (2026-08-14,
 * user request). Price range filters the catalogue/admin `rakhal_price_per_kg`, not the per-farm
 * `effective_price_per_kg` (see backend `listPaged`'s doc comment). */
export interface IngredientListFilters {
  search?: string;
  /** Multi-select (2026-08-15, reusable FilterBar checklist) — sent to the backend comma-joined,
   * matched there with an `in`. */
  feedClass?: FeedClass[];
  priceMin?: number;
  priceMax?: number;
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

/** `PATCH /feed/ingredients/custom/:id` — every field optional (partial update of a farm's own
 * quick-add ingredient). Rejects a catalogue row or another farm's row (backend-enforced). */
export type UpdateCustomIngredientPayload = Partial<CreateCustomIngredientPayload>;

/** `POST /feed/ingredients/:id/override` — a farm's own price/nutrition override layered on top of
 * a Rakhal-catalogue (or another farm's) ingredient, never mutating the shared row itself. `null`
 * on any field clears just that field back to the catalogue default. */
export interface SetFeedOverridePayload {
  customPricePerKg?: number;
  customDmPct?: number;
  customCpPct?: number;
  customMeMjPerKgDm?: number;
  customFatPct?: number;
  customNdfPct?: number;
  customRdpPct?: number;
  customRupPct?: number;
  customStarchPct?: number;
  customAdfPct?: number;
  customCalciumPct?: number;
  customPhosphorusPct?: number;
  customTdnPct?: number;
  notes?: string;
}

/** Component decomposition behind each headline number (RAKHAL-258's `breakdown`). */
export interface FeedRequirementBreakdown {
  dm: { lactation: number; pregnancy: number; heiferGrowth: number; bcsAdjustment: number };
  me: { maintenance: number; milk: number; pregnancy: number; heiferGrowth: number };
  cp: { maintenance: number; milk: number; pregnancy: number; heiferGrowth: number };
}

/** All 16 outputs the engine has returned since RAKHAL-258. The five originals kept their
 * names; the rest were simply never declared here, which is why the wizard showed only five. */
export interface FeedRequirements {
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  ndf_kg: number;
  fat_kg: number;
  /** Net energy for lactation, Mcal/day. */
  ne_mcal: number;
  /** How energy-dense the ration has to be. */
  energy_density_mj_per_kg_dm: number;
  /** The diet-density target nutritionists actually formulate to. */
  cp_pct_of_dm: number;
  tdn_kg: number;
  /** `null` for a manual requirement (MILESTONE 28): Ca/P need her live weight and milk, so they are "not set". */
  calcium_kg: number | null;
  phosphorus_kg: number | null;
  adf_kg: number;
  /** Rumen-degradable protein, % of total CP. */
  rdp_pct: number;
  /** Rumen-undegradable protein, % of total CP. */
  rup_pct: number;
  /** `ndf_kg` is the minimum; over-supply depresses intake. */
  ndf_max_kg: number;
  ca_p_ratio_target: number;
  /** Absent or `null` for a manual requirement. */
  breakdown?: FeedRequirementBreakdown | null;
}

/** Where a cow's requirement came from (MILESTONE 28): the calculated model, or figures typed by hand. */
export type RequirementSource = "DYNAMIC" | "MANUAL";

/** Present only when `source` is `MANUAL`. `stale` = her calculated need has moved since the values were set. */
export interface ManualRequirementInfo {
  override_id: string;
  set_at: string;
  set_by: string;
  note: string | null;
  stale: boolean;
  drift: { dm_pct: number; cp_pct: number; me_pct: number };
  animal_type_changed: boolean;
}

/** `GET /feed/requirements` — shape varies by mode (`FeedRequirementsService.calc`): manual/`cattleId`
 * modes return a flat `requirements`.
 * `data_source` (added 2026-07-18 for the standalone nutrition calculator, user request — "help the
 * farmer track... how much comes from real cattle records vs a manual guess") flags whether each of
 * weight/milk-yield came from a real record, a 7-day milk-log average, a manual override, or
 * (cattle mode only, no manual fallback given) an assumed zero. */
export interface FeedRequirementsResult {
  inputs: {
    weight_kg: number;
    milk_target_l: number;
    milk_fat_pct: number;
    gestation_days?: number | null;
    bcs?: number | null;
    dim?: number | null;
    milk_protein_pct?: number | null;
    animal_type?: string;
  };
  data_source?: { weight: string; milk_yield: string };
  requirements?: FeedRequirements;
  /** MILESTONE 28 — absent on an older backend, meaning calculated. */
  source?: RequirementSource;
  /** What the calculated model says today; only for a manual cow. */
  dynamic_requirements?: FeedRequirements;
  manual?: ManualRequirementInfo;
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
  /** `null` for a line that names only an inventory product (RAKHAL-447) — key it with `formLineKey`. */
  ingredient_id: string | null;
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
  /** RAKHAL-422 (2026-09-13): at most one of these is set — a line linking a real inventory batch
   * (deducted + priced from the batch's actual cost on finalize, RAKHAL-423) rather than staying a
   * virtual catalogue line. Keyed by `ingredient_id` on the backend, not array position — see
   * `enrich()`'s own doc comment on why the two source arrays aren't guaranteed 1:1 by index. */
  feed_item_id: string | null;
  /** RAKHAL-447: the lot this line is pinned to; `null` = the FIFO head at the time of use. */
  feed_item_batch_id: string | null;
  feed_stock_id: string | null;
}

/** `GET /feed/concentrations` list row (not detailed — no `ingredients` line items). */
export interface FeedConcentrationSummary {
  id: string;
  kind: FeedConcentrationKind;
  name: string;
  target_type: FeedTargetType;
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
  /** Optional when `feedItemId` is set (RAKHAL-447): a purchased product carries its own nutrition. */
  ingredientId?: string;
  /** RAKHAL-447: pin this line to one lot of `feedItemId`; omitted = the FIFO head. */
  feedItemBatchId?: string;
  amountKg: number;
  /** RAKHAL-422: optional link to a specific inventory batch this line consumes on finalize. At
   * most one should be set — the picker UI enforces this by construction; the backend validates
   * it authoritatively (farm ownership, not soft-deleted, and the batch's own ingredient matches
   * `ingredientId`) since the frontend can't always compute a precise match itself (a `FeedStock`
   * lot has no `ingredientId` of its own — see `BatchLinkPicker`'s doc comment). */
  feedItemId?: string;
  feedStockId?: string;
}

/** `targetWeightKg`/`targetMilkL` are optional as of Phase 12.3 (2026-07-18) — once a real
 * `cattleId` target is set, the backend resolves both from that target's own
 * weight/milk records when omitted (same derivation `GET /feed/requirements` already exposes for
 * the wizard's live preview); they stay available as a manual override/fallback. */
export interface CreateFeedConcentrationPayload {
  kind: FeedConcentrationKind;
  name: string;
  durationDays?: number;
  targetType: FeedTargetType;
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
 * never a reusable ingredient — see the backend's `finalize()` doc comment).
 *
 * **Superseded 2026-09-13 (RAKHAL-421, MILESTONE 8c):** the 2026-07-19 stance this comment used to
 * carry — "`stock` is `null` for a `CONCENTRATE_TEMPLATE`, only a TMR produces a real stock lot" —
 * is no longer true. **Both** kinds now produce a `FeedStock` lot (`stock` is non-null for either),
 * distinguished by the lot's own `kind` field. See `docs/EPIC_PREPARED_FEED.md`, ADR-025. Only the
 * fields the frontend actually reads are typed here. */
export interface FinalizeConcentrationResult {
  concentration_id: string;
  stock: FeedStock | null;
  ingredient: { id: string; name_en: string } | null;
  /** Populated only for a `FEED_MIXTURE` finalize whose unlinked (catalogue-priced) cost is above
   * zero — the `FinanceTransaction` (and, if paid via `WALLET`, the `WalletTransaction`) created to
   * pay for that portion (RAKHAL-424: linked-batch cost is an inventory transfer, no cash moves).
   * `null` for a `CONCENTRATE_TEMPLATE` finalize — a Concentrate Mixer's own finalize never posts a
   * journal regardless of unlinked cost, unlike a TMR's (confirmed by reading `finalize()` directly,
   * 2026-09-14 — worth a debt ticket if that asymmetry isn't deliberate). */
  finance: { transaction_id: string; reference: string; wallet_transaction_id: string | null } | null;
}

/** `POST /feed/concentrations/:id/finalize` body. Finalize never pays (2026-09-24): every recipe
 * line must already be in inventory, so no wallet is sent. `batchQuantityKg` optional override. */
export interface FinalizeConcentrationPayload {
  batchQuantityKg?: number;
}

/** `GET /feed/concentrations/:id/inventory-check` — which recipe lines are backed by inventory the
 * farm owns. A recipe can be *built* from anything, but only *finalized* when `can_finalize`. */
export interface ConcentrationInventoryCheck {
  can_finalize: boolean;
  lines: {
    ingredient_id: string | null;
    name: string;
    amount_kg: number;
    status: "IN_INVENTORY" | "MISSING";
    feed_item_id: string | null;
    feed_stock_id: string | null;
    /** Kg on hand; `null` when it can't be computed (a feed item with no kg-per-unit). */
    available_kg: number | null;
  }[];
  /** Lines the farm doesn't stock — must be added to Inventory before finalizing. */
  missing: {
    ingredient_id: string | null;
    name: string;
    amount_kg: number;
    feed_class: FeedClass | null;
    feed_sub_type: FeedSubType | null;
    /** Made from a Concentrate Mixer — restocked by finalizing that concentrate, not by buying. */
    is_prepared_feed: boolean;
  }[];
  shortfalls: { name: string; needed_kg: number; available_kg: number }[];
}

/** `POST /feed/concentrations/bulk-delete` — multi-select delete (user request 2026-07-18). */
export interface BulkDeleteConcentrationPayload {
  ids: string[];
}

export interface NormalizeConcentrationResult {
  requirements: FeedRequirements;
  items: { ingredient_id: string | null; feed_item_id?: string | null; amount_kg: number }[];
  totals: FeedFormulaTotals;
  balance_score: number;
}

/** `FeedStockService.mapStock` — one physical batch produced by finalizing a Concentrate Mixer or
 * TMR (`sourceConcentrationId` points at whichever produced it). Phase 12.4 (2026-07-18) frontend —
 * the backend has had this since Phase 4, this is the first frontend type/consumer for it. */
export interface FeedStock {
  id: string;
  /** RAKHAL-421 (2026-09-13): both a Concentrate Mixer and a Total Mixed Ration finalize now
   * produce a `FeedStock` lot — this discriminates which recipe kind produced it. Existing rows
   * backfilled to `FEED_MIXTURE`; the `feed-stock-columns.tsx`/`feed-stock-grid.tsx` badge already
   * read this via a `source_concentration_id` join against `useConcentrations()`, so it renders
   * correctly for both kinds without further UI change — this field surfaces the batch's own
   * value directly, matching what `mapStock()` already returns. */
  kind: FeedConcentrationKind;
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

/** `POST /feed/distributions` — "Feed Today" (Phase 12.4, 2026-07-18). The target (one cow vs
 * the herd) is never supplied directly — it's derived server-side from `concentrationId`'s own
 * `targetType`, matching how a TMR is already either INDIVIDUAL- or HERD-targeted from creation. */
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
  cattle_id: string | null;
  distributed_at: string;
  total_actual_kg: number;
  total_actual_cost: number;
  created_at: string;
}

/** `GET /feed/efficiency` — planned-vs-actual + feed cost/litre for a single cow (`cattleId`). */
export interface FeedEfficiencyResult {
  cattle_id: string | null;
  cattle_name: string | null;
  period: string;
  distributions: number;
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

// ==== Feeding-system upgrade (2026-08-13, user request) =====================================

/** `GET /feed/cattle/:cattleId/resolved-ration` — layered targeting resolution: which active
 * `FEED_MIXTURE` ration this cow is actually on, most-specific-wins (INDIVIDUAL > HERD). */
export interface ResolvedRation {
  match_level: "INDIVIDUAL" | "GROUP" | "HERD" | null;
  concentration: FeedConcentrationDetail | null;
}

/** `GET /feed/cattle/:cattleId/dmi` — actual vs expected dry-matter intake for a cow. */
export interface DmiComparison {
  expected_dmi_kg: number;
  actual_dmi_kg: number | null;
  delta_pct: number | null;
  match_level: "INDIVIDUAL" | "GROUP" | "HERD" | null;
}

/** `GET /feed/today-requirement` — farm-wide rollup of every active ration's ingredient
 * requirement for today, aggregated across all rations by ingredient. */
/** What the animals need, computed from live cattle records (RAKHAL-412). Present whenever the
 * farm has cattle — it does not depend on a ration existing. `null` only for a farm with no
 * cattle, or none with a recorded weight. */
export interface HerdRequirementBlock {
  headcount: number;
  /** MILESTONE 28: how many of them are on a hand-set requirement. Absent on an older backend. */
  manual_headcount?: number;
  /** How many carry Ca/P (a manual cow has none), so the Ca/P totals cover only that many. */
  ca_p_headcount?: number;
  inputs: {
    weight_kg: number;
    milk_target_l: number;
    bcs: number | null;
    cattle_with_weight: number;
    cattle_with_milk_data: number;
  };
  data_source: { weight: string; milk_yield: string };
  per_cow: FeedRequirements;
  herd_total: FeedRequirements;
}

export interface TodaysFeedRequirement {
  by_ingredient: { ingredient_id: string; name: string; total_kg: number }[];
  /** One row per active ration (INDIVIDUAL = 1 cow, HERD = the whole herd). */
  by_ration: {
    /** `null` for a plan-based row (RAKHAL-458: grid feedings resolve through plans, not a recipe). */
    concentration_id: string | null;
    name: string;
    headcount: number;
    total_kg: number;
  }[];
  grand_total_kg: number;
  /** RAKHAL-412 — the animal requirement, independent of any ration. */
  requirement?: HerdRequirementBlock | null;
  has_active_ration?: boolean;
}

/** Which raw inventory catalogue a Feeding Grid entry pulls from — a Purchased `FeedItem` (bought
 * ingredient) or a Prepared `FeedStock` lot (a finalized Total Mixed Ration batch). */
export type FeedGridSourceType = "FEED_ITEM" | "FEED_STOCK";

/** One already-saved (not yet confirmed) draft line for a cow on the Feeding Grid, as returned by
 * `GET /feed/grid`. A cow can carry more than one draft (e.g. two different items across two
 * separate Save actions on the same date), though the grid's own bulk-assign flow only ever writes
 * one source item per Save/Confirm call. */
export interface FeedGridDraft {
  id: string;
  source_type: FeedGridSourceType;
  feed_item_id: string | null;
  feed_stock_id: string | null;
  offered_kg: number;
}

/** RAKHAL-431 resolution ladder result: a cow's own last-used source (past the availability
 * guard, with batch fall-forward) — `null` when it doesn't resolve. The UI pre-fills a row's source picker from this; it never auto-submits. */
export interface FeedGridSource {
  source_type: FeedGridSourceType;
  feed_item_id: string | null;
  feed_stock_id: string | null;
}

/** `GET /feed/grid` row — one cow. `default_offered_kg` is the backend-computed carry-forward
 * value (yesterday's confirmed per-head amount) — the frontend only ever displays/edits it, never
 * recomputes it. `null` when the cow has no prior confirmed feeding to carry forward (confirmed
 * live against the real dev stack — a fresh group with no feeding history returns `null`, not `0`).
 * `default_source` (RAKHAL-431/RFE-115) is the same kind of pre-fill, for the per-row source cell. */
export interface FeedGridCow {
  cattle_id: string;
  name: string | null;
  tag_number: string;
  drafts: FeedGridDraft[];
  default_offered_kg: number | null;
  default_source: FeedGridSource | null;
  /** RAKHAL-440/RD-099: sum of whatever's *already confirmed* for this exact date — `null` when
   * nothing has been confirmed yet. Distinct from `default_offered_kg`, which is only a carried-
   * forward suggestion from the most recent PRIOR confirmed day and renders identically whether or
   * not today itself has been touched — the bug this field exists to let the UI fix. */
  confirmed_offered_kg: number | null;
}

/** `GET /feed/grid?date` — the Feeding Grid's own per-day, per-cow view; replaces the
 * single-item Quick Feed dialog (2026-08-15). */
export interface FeedGridResult {
  date: string;
  cows: FeedGridCow[];
}

/** One calendar day's status (RAKHAL-434) — shared shape for both the Feed Grid and Milk Log
 * missed-entry calendars. `before_farm`/`future` are never colorable as a miss. */
export type EntryCalendarDayStatus = "complete" | "partial" | "missing" | "future" | "before_farm";

export interface EntryCalendarDay {
  date: string;
  status: EntryCalendarDayStatus;
}

/** `GET /feed/grid/calendar?month=YYYY-MM` result. */
export interface EntryCalendarResult {
  month: string;
  days: EntryCalendarDay[];
}

/** RAKHAL-441 frontend twin (per-cow) — `GET /feed/grid/cattle/:cattleId/history` row: one
 * confirmed `FeedDistributionCattleItem` for that cow on the queried date, voided or not (the
 * panel is also the correction audit trail — a voided row is shown struck-through, not hidden).
 * Carries the ids (`distribution_id`/`id`) `POST grid/distributions/:id/cattle/:id/void` needs.
 * Corrected twice per user request: day+group-scoped → per-cow multi-day trail → per-cow single
 * date (defaults to today, changeable via a date picker) — matches "what did THIS cow eat today". */
export interface FeedCattleHistoryEntry {
  id: string;
  distribution_id: string;
  offered_kg: number;
  refusal_kg: number;
  cost_tk: number | null;
  feed_name: string | null;
  source_type: FeedGridSourceType | null;
  fed_at: string;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

/** `GET /feed/grid/cattle/:cattleId/history?date=` result — one exact day (server defaults to
 * today when `date` is omitted). */
/** Total nutrition actually fed that day, over active (non-voided) entries only — same field
 * names/units `requirements.ts`'s `computeRequirements()` output uses, so a future "fed vs
 * required" comparison is a straight match. */
export interface FeedCattleHistoryTotals {
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  fat_kg: number;
  ndf_kg: number;
  adf_kg: number;
  starch_kg: number;
  tdn_kg: number;
  calcium_kg: number;
  phosphorus_kg: number;
  rdp_kg: number;
  rup_kg: number;
}

export interface FeedCattleHistoryResult {
  cattle_id: string;
  date: string;
  entries: FeedCattleHistoryEntry[];
  totals: FeedCattleHistoryTotals;
}

/** `POST /feed/grid/distributions/:distributionId/cattle/:cattleItemId/void` body — optional
 * correction reason. */
export interface VoidFeedCattleItemPayload {
  reason?: string;
}

/** `POST .../void` response — the same shape as one `FeedCattleHistoryEntry`'s void fields, not
 * the full row (the backend's `presentVoid()` returns only what changed). */
export interface VoidFeedCattleItemResult {
  id: string;
  cattle_id: string;
  offered_kg: number;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
}

/** RAKHAL-430/RFE-115: `sourceType`/`feedItemId`/`feedStockId` here are this entry's OWN source,
 * overriding the call's top-level default — what lets one grid submission feed different cows from
 * different sources. Omit to fall back to the top-level source. */
export interface FeedGridEntryInput {
  cattleId: string;
  offeredKg: number;
  /** User request 2026-09-23: this farm's cows each eat from their own container, so leftover is
   * reliably measurable per cow. Optional — omit when not weighed back. */
  refusalKg?: number;
  sourceType?: FeedGridSourceType;
  feedItemId?: string;
  feedStockId?: string;
}

/** `POST /feed/grid/draft` — saves per-cow quantities. `sourceType`/`feedItemId`/`feedStockId`
 * (RAKHAL-430) are now only the *default* for any `entries[]` line that doesn't name its own — no
 * inventory effect either way. */
export interface SaveFeedGridDraftPayload {
  date: string;
  sourceType?: FeedGridSourceType;
  feedItemId?: string;
  feedStockId?: string;
  entries: FeedGridEntryInput[];
}

export interface SaveFeedGridDraftResult {
  saved: number;
  drafts: FeedGridDraft[];
}

/** `POST /feed/grid/confirm` — same shared fields as the draft save; `entries` is optional per cow —
 * when omitted for a cow, the backend falls back to that cow's own draft/`default_offered_kg`.
 * Decrements inventory — "the feeding actually happened" step. RAKHAL-430: `sourceType` is now only
 * the default for lines without their own source, so it's optional here too — an all-per-entry
 * confirm needs no top-level source at all. */
export interface ConfirmFeedGridPayload {
  date: string;
  sourceType?: FeedGridSourceType;
  feedItemId?: string;
  feedStockId?: string;
  entries?: FeedGridEntryInput[];
}

/** RAKHAL-430 rewrote `confirm()`'s response into a real multi-source shape — one
 * `FeedDistributionItem` per distinct resolved source, not always exactly one — and each cow now
 * carries its own resolved source back. This replaces the pre-RAKHAL-430 single top-level
 * `source_type`/`feed_item_id`/`feed_stock_id` shape, which the backend no longer returns (a stale
 * type this ticket fixes — no frontend code read those 3 fields, only `cows.length`, so nothing else
 * was broken by the drift). */
export interface ConfirmFeedGridResult {
  id: string;
  date: string;
  total_actual_kg: number;
  total_actual_cost: number;
  sources: {
    source_type: FeedGridSourceType;
    feed_item_id: string | null;
    feed_stock_id: string | null;
    total_kg: number;
  }[];
  cows: {
    cattle_id: string;
    offered_kg: number;
    refusal_kg: number;
    source_type: FeedGridSourceType;
    feed_item_id: string | null;
    feed_stock_id: string | null;
  }[];
}

/** `PATCH /feed/distributions/:id/refusal` — next-day leftover weigh-in. */
export interface PatchRefusalPayload {
  items: { ingredientId: string; refusalKg: number }[];
}

/** `GET /feed/concentrations/:id/versions` — explicit-checkpoint version history (`FEED_MIXTURE`
 * only). Day-to-day edits stay live-sync; a version is only created on an explicit "Save as
 * Template" or the first `finalize()`. */
export interface FeedConcentrationVersion {
  id: string;
  version_number: number;
  name: string | null;
  items?: { ingredientId: string; ingredientName: string; amountKg: number; pricePerKg: number }[];
  total_cost_per_day: number;
  created_at: string;
}

/** `GET /feed/cost-summary` — farm-wide feed cost/cow/day + cost/litre + trend, for the
 * Dashboard widget. */
export interface FeedCostSummary {
  days: number;
  total_cost: number;
  cost_per_cow_per_day: number | null;
  cost_per_litre: number | null;
  headcount: number;
  total_litres: number;
  trend: { date: string; total_cost: number }[];
}

/** Which layer supplied a setting's effective value (RFE-104 / RAKHAL-409). */
export type RequirementSettingSource = "farm" | "preset" | "default";

/** Everything an editor needs to render one tuning number, straight from the backend so the
 * labels, units and bounds have exactly one definition. */
export interface RequirementSettingField {
  group: string;
  label: string;
  /** Empty for dimensionless factors. */
  unit: string;
  min: number;
  max: number;
}

/** `GET /feed/requirement-settings`. `fields` covers the 32 editable scalars; `sources` also
 * includes `pregnancyIntakeStages`, the nested stage table, which this sheet does not edit. */
export interface RequirementSettingsResult {
  effective: Record<string, unknown>;
  defaults: Record<string, unknown>;
  preset: { id: string; name: string; version: number; effective_from: string } | null;
  farm_changes: Record<string, number>;
  sources: Record<string, RequirementSettingSource>;
  fields: Record<string, RequirementSettingField>;
}

// ---- Manual requirement per cow (MILESTONE 28, RFE-129) --------------------------------------------

/** One cow's requirement after the source decision — the shape of `GET /feed/requirements?cattleIds=` rows. */
export interface ResolvedCowRequirement {
  cattle_id: string;
  source: RequirementSource;
  /** The calculated model's inputs (also in manual mode). */
  inputs: {
    weight_kg: number;
    milk_target_l: number;
    gestation_days?: number | null;
    bcs?: number | null;
    dim?: number | null;
    animal_type?: string;
  };
  /** Data-quality flags only; empty when manual. */
  flags: string[];
  requirements: FeedRequirements;
  /** What the calculated model says today; only when `source` is `MANUAL`. */
  dynamic_requirements?: FeedRequirements;
  manual?: ManualRequirementInfo;
}

/** One row of a cow's manual-requirement history. `dynamic_snapshot` = the calculated figures when it was set. */
export interface RequirementOverrideRow {
  id: string;
  cattle_id: string;
  dm_kg: number;
  cp_kg: number;
  me_mj: number;
  note: string | null;
  dynamic_snapshot: { dm_kg: number; cp_kg: number; me_mj: number; animal_type: string };
  effective_from: string;
  /** `null` = still in force. */
  effective_to: string | null;
  end_reason: "REPLACED" | "TURNED_OFF" | null;
  set_by: string;
  ended_by: string | null;
}

/** `GET /feed/cattle/:id/requirement-override`. `last` = newest closed row, to pre-fill "turn back on". */
export interface RequirementOverrideDetail {
  active: RequirementOverrideRow | null;
  resolved: ResolvedCowRequirement;
  last: RequirementOverrideRow | null;
}

export interface SetRequirementOverridePayload {
  dmKg: number;
  cpKg: number;
  meMj: number;
  note?: string;
}

/** Saved anyway — shown after the save so the manager can double-check an unusual figure. */
export interface RequirementOverrideWarning {
  code: "dm_body_weight" | "cp_share" | "energy_density";
  message: string;
}

export interface SetRequirementOverrideResult {
  active: RequirementOverrideRow;
  resolved: ResolvedCowRequirement;
  warnings: RequirementOverrideWarning[];
}

export interface TurnOffRequirementOverrideResult {
  active: null;
  resolved: ResolvedCowRequirement;
}
