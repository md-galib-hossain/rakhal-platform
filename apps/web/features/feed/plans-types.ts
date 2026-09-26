/**
 * MILESTONE 27 — Feed Programs (RFE-126). Mirrors the backend's `/feed/plans`, `/feed/plan-assignments`
 * and `/feed/cattle/:id/program` payloads (RAKHAL-455/456/458, `docs/EPIC_FEED_PROGRAMS.md`). Kept out of
 * `types.ts` so this ticket does not touch a file other feed tickets edit.
 *
 * A **program** is always a feed plan: the daily kg per head of bought feed items and made feed
 * (concentrate/TMR recipes). A plan does nothing until it is **applied** to cows, a group or the herd.
 */
import type { FeedConcentrationKind } from "./types";

export type FeedPlanKind = "PLAN" | "TMR_SHORTCUT" | "CONCENTRATE_SHORTCUT";
export type FeedPlanLineType = "FEED_ITEM" | "PREPARED";
export type FeedPlanTarget = "INDIVIDUAL" | "GROUP" | "HERD";
export type FeedFitSeverity = "ok" | "warn" | "bad";

export interface FeedPlanLine {
  id: string;
  line_type: FeedPlanLineType;
  feed_item_id: string | null;
  concentration_id: string | null;
  name: string | null;
  recipe_kind: FeedConcentrationKind | null;
  kg_per_day: number;
  sort_order: number;
}

/** Where a plan is applied right now. */
export interface FeedPlanAppliedTo {
  cattle_ids: string[];
  group_ids: string[];
  herd: boolean;
}

export interface FeedPlan {
  id: string;
  name: string;
  kind: FeedPlanKind;
  notes: string | null;
  made_for_cattle_id: string | null;
  made_for_animal_group_id: string | null;
  /** Requirement snapshot taken when "made for" was set — for drift display. */
  reference_requirement: {
    basis: "COW" | "GROUP_AVERAGE";
    headcount: number;
    dm_kg: number;
    cp_kg: number;
    me_mj: number;
  } | null;
  is_active: boolean;
  applied_to: FeedPlanAppliedTo;
  lines: FeedPlanLine[];
  total_kg_per_day: number;
  created_at: string;
  updated_at: string;
}

export interface FeedPlanLineInput {
  lineType: FeedPlanLineType;
  feedItemId?: string;
  concentrationId?: string;
  kgPerDay: number;
}

export interface CreateFeedPlanPayload {
  name: string;
  kind?: FeedPlanKind;
  notes?: string;
  madeForCattleId?: string;
  madeForAnimalGroupId?: string;
  lines: FeedPlanLineInput[];
}

export type UpdateFeedPlanPayload = Partial<CreateFeedPlanPayload>;

export interface FeedFitNutrient {
  delta_pct: number | null;
  severity: FeedFitSeverity;
}

export interface FeedProgramFit {
  severity: FeedFitSeverity;
  /** True when any input was an assumption or a line has no resolvable lot. */
  estimated: boolean;
  dm: FeedFitNutrient;
  cp: FeedFitNutrient;
  me: FeedFitNutrient;
}

export interface FeedPlanFitLine {
  line_id: string;
  line_type: FeedPlanLineType;
  feed_item_id: string | null;
  concentration_id: string | null;
  name: string;
  kg_per_day: number;
  density: { dm_pct: number; cp_pct: number; me_mj_per_kg_dm: number } | null;
  source: {
    source_type: "FEED_ITEM" | "FEED_STOCK";
    feed_item_id: string | null;
    feed_stock_id: string | null;
  } | null;
  stock_ok: boolean;
  supply: { as_fed_kg: number; dm_kg: number | null; cp_kg: number | null; me_mj: number | null };
}

export type FeedNutrientKey =
  | "dm"
  | "cp"
  | "me"
  | "fat"
  | "ndf"
  | "adf"
  | "tdn"
  | "calcium"
  | "phosphorus"
  | "ca_p_ratio"
  | "rdp_pct"
  | "rup_pct"
  | "starch";

/** One line of the full nutrition check (`FeedPlanFitResult.cows[].nutrients`). */
export interface FeedNutrientRow {
  key: FeedNutrientKey;
  unit: "kg" | "MJ" | "% of CP" | ": 1";
  /** `null` when it can't be worked out (a Ca:P ratio with no phosphorus). */
  supply: number | null;
  /** `null` for a nutrient with no requirement (starch — shown for information). */
  requirement: number | null;
  /** Upper limit where one exists (NDF: over-supply depresses intake). */
  max: number | null;
  delta_pct: number | null;
  /** `unknown` = a fed lot doesn't carry this nutrient, so `supply` is a minimum and isn't judged. */
  severity: FeedFitSeverity | "unknown";
  measured: boolean;
}

export interface FeedPlanFitResult {
  plan_id: string;
  date: string;
  lines: FeedPlanFitLine[];
  supply: { as_fed_kg: number; dm_kg: number; cp_kg: number; me_mj: number };
  /** False when a line has no resolvable lot — the totals are then a floor. */
  supply_complete: boolean;
  cows: {
    cattle_id: string;
    requirement: { dm_kg: number; cp_kg: number; me_mj: number };
    delta_pct: { dm: number | null; cp: number | null; me: number | null };
    fit: FeedProgramFit;
    /** Every nutrient the lots carry vs her requirement — optional so an older backend still renders the 3-row table. */
    nutrients?: FeedNutrientRow[];
    flags: string[];
  }[];
  missing_cattle_ids: string[];
}

/** Hand-entered animal figures for the editor's requirement scratchpad (`POST /feed/plans/preview-fit`). */
export interface ManualRequirementInput {
  weightKg: number;
  milkTargetL: number;
  milkFatPct?: number;
  gestationDays?: number;
  bcs?: number;
  dim?: number;
  animalType?: "COW" | "HEIFER" | "DRY";
}

/** Lines that are not saved yet, against ONE saved animal (`cattleId`) or hand-entered figures (`manual`). */
export interface PreviewFitPayload {
  lines: FeedPlanLineInput[];
  cattleId?: string;
  manual?: ManualRequirementInput;
}

/** What `previewFit` returns: one animal's requirement and how the lines add up against it. */
export interface PreviewFitResult {
  lines: FeedPlanFitLine[];
  supply: { as_fed_kg: number; dm_kg: number; cp_kg: number; me_mj: number };
  supply_complete: boolean;
  nutrients: FeedNutrientRow[];
  fit: FeedProgramFit;
  inputs: Record<string, unknown>;
  /** Data-quality flags — an assumed weight, missing milk record… (empty for hand-entered figures). */
  flags: string[];
}

export interface ApplyFeedPlanPayload {
  targetType: FeedPlanTarget;
  /** `INDIVIDUAL`: one or many cows. */
  cattleIds?: string[];
  /** `GROUP`. */
  animalGroupId?: string;
}

export interface FeedPlanAssignment {
  id: string;
  plan_id: string;
  target_type: FeedPlanTarget;
  cattle_id: string | null;
  animal_group_id: string | null;
  applied_at: string;
  applied_by: string;
  removed_at: string | null;
  removed_by: string | null;
  plan_name?: string;
  plan_kind?: FeedPlanKind;
}

export interface ApplyFeedPlanResult {
  plan_id: string;
  assignments: FeedPlanAssignment[];
  /** Programs this apply ended on the same targets. */
  replaced: (FeedPlanAssignment & { plan_name: string })[];
  /** Cows that were on a group program and now sit on their own individual one. */
  leaves_group_program: { cattle_id: string; group_id: string | null; plan_id: string; plan_name: string }[];
}

/** `GET /feed/cattle/:id/program`. */
export interface CattleFeedProgram {
  program: {
    assignment_id: string;
    plan_id: string;
    plan_name: string;
    kind: FeedPlanKind;
    via: FeedPlanTarget;
    group_id: string | null;
    /** True when the cow is in several groups that each have a program (newest applied is used). */
    conflict: boolean;
    lines: {
      line_id: string;
      line_type: FeedPlanLineType;
      name: string;
      kg_per_day: number;
      stock_ok: boolean;
    }[];
  } | null;
}

/** The group-overlap 409's `details.conflicting_cattle`. */
export interface FeedPlanOverlapConflict {
  cattle_id: string;
  group_id: string;
  plan_id: string;
  plan_name: string;
}

// ---- Feeding Grid × programs (RFE-127; backend RAKHAL-457/458) ---------------------------------------------

export interface FeedGridSectionLine {
  line_id: string;
  line_type: FeedPlanLineType;
  name: string;
  kg_per_day: number;
  /** The whole daily kg — what the grid pre-fills (editable; one confirm per cow per day). */
  prefill_kg: number;
  /** The concrete thing a feeding draws: the bought item, or the recipe's newest lot with stock. `null` = a recipe with no batch made yet. */
  source: {
    source_type: "FEED_ITEM" | "FEED_STOCK";
    feed_item_id: string | null;
    feed_stock_id: string | null;
  } | null;
  density: { dm_pct: number; cp_pct: number; me_mj_per_kg_dm: number } | null;
  stock_ok: boolean;
}

/** One resolved program on `GET /feed/grid` — one section per program (individual programs of one plan share a section). */
export interface FeedGridSection {
  id: string;
  plan_id: string;
  plan_name: string;
  kind: FeedPlanKind;
  via: FeedPlanTarget;
  group_id: string | null;
  /** Some cow here is in several groups that each have a program. */
  conflict: boolean;
  cattle_ids: string[];
  lines: FeedGridSectionLine[];
  fit_summary: { ok: number; warn: number; bad: number; estimated: number };
}

/** The extra per-cow fields `GET /feed/grid` now carries (additive on `FeedGridCow`). */
export interface FeedGridProgramCowFields {
  program_section_id: string | null;
  program_conflict: boolean;
  planned_kg_by_line: Record<string, number>;
  requirement: { dm_kg: number; cp_kg: number; me_mj: number; flags: string[] } | null;
  planned_supply: { dm_kg: number; cp_kg: number; me_mj: number; complete: boolean } | null;
  /** Σ of today's confirmed (non-voided) feedings, from each row's frozen nutrition profile; `null` = nothing confirmed. */
  confirmed_supply: { dm_kg: number; cp_kg: number; me_mj: number; complete: boolean } | null;
  fit: FeedProgramFit | null;
}

/** A draft row also remembers the plan line it was pre-filled from. */
export interface FeedGridDraftPlanFields {
  plan_line_id: string | null;
  /** Leftover weighed back and saved with the draft (RAKHAL-453). */
  refusal_kg: number | null;
}

/** One feed line for one cow in a multi-line draft/confirm: a plan line's kg (`planLineId` set) or an off-plan extra. */
export interface ProgramGridEntryLine {
  planLineId?: string;
  sourceType: "FEED_ITEM" | "FEED_STOCK";
  feedItemId?: string;
  feedStockId?: string;
  offeredKg: number;
  refusalKg?: number;
}

export interface ProgramGridEntry {
  cattleId: string;
  /** Cow total; the server splits it across the lines in proportion to offered kg. */
  refusalKg?: number;
  lines: ProgramGridEntryLine[];
}

export interface ProgramGridPayload {
  date: string;
  entries: ProgramGridEntry[];
}
