/**
 * Mirrors `rakhal-backend/src/modules/cattle/application/services/cattle.service.ts`'s actual
 * return shapes — not the aspirational `Rakhal_API.md` §4, which documents page/per_page
 * pagination (this backend is cursor-only, `CursorPaginationQueryDto`) and a fully camelCase list
 * row. The real row is a raw Prisma `Cattle` include, so most fields ARE camelCase, but
 * `attachListPhotos` bolts on one snake_case field (`profile_photo`) and `highlights()` is entirely
 * snake_case — both confirmed by reading the service directly, kept as-is rather than "corrected"
 * since this is a frontend-only ticket (not touching the backend module).
 */

export type CattleGender = "MALE" | "FEMALE" | "CASTRATED_MALE";
export type CattlePurpose = "MILK" | "BREEDING" | "MEAT" | "CALF" | "BULL_SERVICE" | "DUAL_PURPOSE";
/** RAKHAL-269 v2: gained `CULLED` (distinct from `DEAD`/`SOLD`) — see `ArchiveCattleDto`. */
export type CattleStatus = "ACTIVE" | "SOLD" | "DEAD" | "CULLED" | "TRANSFERRED" | "MISSING" | "ARCHIVED";
/** RAKHAL-269 v2 correction: trimmed to the two real production states — lifecycle/archival
 * (sold/deceased) now lives on `CattleStatus` + soft-delete instead of being overloaded onto this
 * enum. */
export type ProductionStatus = "MILKING" | "DRY";
/** RAKHAL-271 v2 correction: replaces the old 9-value `ReproductiveStatus`. Time-bound alerts
 * (in-heat/pregnancy-check-due/expected-to-calve) moved to a derived, not-stored
 * `ReproductionAlert[]` on the backend — see `CattleListItem.reproductionAlerts`
 * (RAKHAL-282/283/284, consumed on the table + cattle detail). */
export type ReproductiveStatus =
  | "NOT_ELIGIBLE"
  | "POSTPARTUM_WAITING"
  | "OPEN"
  | "BRED_AWAITING_CONFIRMATION"
  | "PREGNANT";
export type HealthStatusFilter = "HEALTHY" | "SICK" | "IN_TREATMENT" | "WITHHOLDING" | "QUARANTINE";

/** RAKHAL-270 — derived from gender/age/calving history (`animal-category.ts#deriveAnimalCategory`).
 * Always present on both list rows and detail (`composeStatus()` spreads it unconditionally). */
export type AnimalCategory = "CALF" | "HEIFER" | "COW" | "BULL" | "STEER";

/** RAKHAL-272 — derived, time-bound reproduction alerts layered on top of `reproductiveStatus`
 * (`reproduction/domain/reproduction-alerts.ts#deriveReproductionAlerts`). Only computed for
 * `FEMALE` animals with a non-null `reproductiveStatus`; otherwise an empty array (never null on
 * the wire — `composeStatus()` defaults it to `[]`). */
export type ReproductionAlert =
  | "HEAT_DETECTED"
  | "PREGNANCY_CHECK_DUE"
  | "OVERDUE_PREGNANCY_CHECK"
  | "REPEAT_BREEDER"
  | "LONG_DAYS_OPEN"
  | "CALVING_DUE"
  | "CALVING_OVERDUE"
  | "ABORTION_HISTORY"
  | "REPRODUCTIVE_HOLD";

/** RAKHAL-273 — `reproduction/domain/lactation-stage.ts#deriveLactationStage`. Null when the
 * animal has no active lactation (e.g. a heifer, or a dry cow with no in-progress lactation). */
export type LactationStage = "FRESH" | "EARLY" | "MID" | "LATE" | "DRY_PERIOD";

/** RAKHAL-273 — `reproduction/domain/pregnancy-stage.ts#derivePregnancyStage`. Null unless the
 * animal currently has an active pregnancy. */
export type PregnancyStage = "EARLY" | "MID" | "LATE" | "CLOSE_UP";

export interface MediaUrls {
  asset_id: string;
  thumb_url: string;
  full_url: string | null;
  width: number | null;
  height: number | null;
  expires_at: string;
}

export interface CattleSummary {
  id: string;
  name: string | null;
  tagNumber: string;
}

export interface Breed {
  id: string;
  name: string;
}

export interface Shed {
  id: string;
  name: string;
  code: string;
}

export interface FeedGroup {
  id: string;
  name: string;
}

export interface CattleListItem {
  id: string;
  name: string | null;
  tagNumber: string;
  gender: CattleGender;
  dateOfBirth: string | null;
  purpose: CattlePurpose;
  status: CattleStatus;
  /** Nullable since RAKHAL-269 v2: immature/never-milked animals (and dry-period animals before
   * their first freshening) carry no production state. */
  productionStatus: ProductionStatus | null;
  shedId: string | null;
  feedGroupId: string | null;
  lastBcs: number | null;
  lastWeightKg: number | null;
  aqrScore: number | null;
  breed: Breed | null;
  shed: Shed | null;
  mother: CattleSummary | null;
  father: CattleSummary | null;
  reproductiveStatus: ReproductiveStatus | null;
  healthStatus: HealthStatusFilter;
  dim: number | null;
  /** RAKHAL-270/272/273 — see the type doc comments above. All 4 are composed on both the list
   * and detail rows (`composeStatus()` spreads them unconditionally, not detail-only). */
  animalCategory: AnimalCategory;
  reproductionAlerts: ReproductionAlert[];
  lactationStage: LactationStage | null;
  pregnancyStage: PregnancyStage | null;
  /** Snake_case on the wire — see the header comment. */
  profile_photo: MediaUrls | null;
}

/** `GET /cattle/highlights` — snake_case on the wire, see the header comment. */
export interface CattleHighlights {
  total_active: number;
  total_change_pct: number | null;
  avg_herd_aqr: number;
  aqr_change_pct: number | null;
  breeding_ready_count: number;
  todays_yield_l: number;
  yield_change_pct: number | null;
}

export interface CattleListFilters {
  search?: string;
  breedId?: string;
  shedId?: string;
  feedGroupId?: string;
  productionStatus?: ProductionStatus;
  healthStatus?: HealthStatusFilter;
  /** Category quick-filter above "All Cattle View" (`CattleCategoryTabs`) — both fields already
   * supported by the backend's `ListCattleQueryDto`, just not previously exposed on the frontend. */
  purpose?: CattlePurpose;
  reproductiveStatus?: ReproductiveStatus;
  /** RAKHAL-289 — real derived-category filter now supported server-side
   * (`ListCattleQueryDto.animalCategory`, `list-cattle-query.dto.ts`). Replaces the old
   * `reproductiveStatus`/`purpose` proxies for the Heifer/Calf highlight tiles. */
  animalCategory?: AnimalCategory;
}

export const BULK_ACTIONS = ["change_shed", "change_feed_group", "mark_sold", "export"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

export interface BulkCattleResult {
  action: BulkAction;
  updated: number;
  failed: number;
  items?: CattleListItem[];
}

export type CattleSourceType = "BORN" | "PURCHASED" | "GIFTED" | "UNKNOWN";

/** RAKHAL-280 — generic per-animal hold (`AnimalHoldController`, `cattle.hold`-gated), the one
 * mechanism backing `REPRODUCTIVE_HOLD` (reproduction alert) and `DISCARD_REQUIRED` (milk
 * eligibility) — no ad-hoc booleans elsewhere. Mirrors the raw Prisma `AnimalHold` row. */
export type AnimalHoldType = "REPRODUCTIVE" | "MILK_DISCARD" | "QUARANTINE" | "OTHER";

export interface AnimalHold {
  id: string;
  farmId: string;
  cattleId: string;
  type: AnimalHoldType;
  reason: string;
  startedAt: string;
  endedAt: string | null;
  createdBy: string;
  releasedBy: string | null;
}

/**
 * `GET/POST/PATCH /cattle(/:id)` single-resource shape (`cattle.service.ts#composeStatus` +
 * `#attachDetailPhoto`) — the raw Prisma row (all `CreateCattleDto` fields as scalars, incl.
 * `motherId`/`fatherId` alongside the `mother`/`father` summary relations) plus the same derived
 * fields the list row gets. Detail photo carries a signed `full_url`, unlike the list's thumb-only.
 */
export interface CattleDetail extends CattleListItem {
  image: string | null;
  color: string | null;
  notes: string | null;
  motherId: string | null;
  fatherId: string | null;
  sourceType: CattleSourceType | null;
  status: CattleStatus;
  isActive: boolean;
}

/** `POST/PATCH /cattle(/:id)` body — mirrors `CreateCattleDto`/`UpdateCattleDto`. */
export interface CattleFormPayload {
  name?: string;
  tagNumber: string;
  breedId?: string;
  gender: CattleGender;
  dateOfBirth?: string;
  purpose: CattlePurpose;
  shedId?: string;
  feedGroupId?: string;
  motherId?: string;
  fatherId?: string;
  sourceType?: CattleSourceType;
  weightKg?: number;
  color?: string;
  notes?: string;
  /** RAKHAL-297 — mirrors `CreateCattleDto.priorCalvings` (`@IsOptional() @IsInt() @Min(1)`),
   * already accepted by the backend. Lets a purchased already-calved cow be recorded correctly as
   * `COW` (not `HEIFER`) from creation, instead of only via the later status-change dialog. */
  priorCalvings?: number;
}

// ---- RFE-023 follow-up: BCS + weight recording (`cattle.constants.ts#BCS_ALLOWED_SCORES`) --------

/** 1.0–5.0 in 0.25 steps (PRD §8.6 / RAKHAL-038) — mirrors the backend's `BCS_ALLOWED_SCORES`. */
export const BCS_ALLOWED_SCORES: number[] = Array.from({ length: 17 }, (_, i) => 1 + i * 0.25);

/** `POST /cattle/:id/bcs` response (`bcs.service.ts#recordBcs`). */
export interface BcsRecordResult {
  id: string;
  score: number;
  date: string;
  notes: string | null;
}

/** `POST /cattle/:id/weight` response (`weight.service.ts#recordWeight`). */
export interface WeightRecordResult {
  id: string;
  weightKg: number;
  date: string;
  notes: string | null;
}

/** RAKHAL-296-F — `POST /reproduction/cattle/:id/purchased-lactation` response (RAKHAL-281's
 * `createPurchasedLactation`, returns the created `Lactation` row). Only the fields this feature
 * actually consumes are modeled here (not the full `Lactation` shape — that's `LactationRow` in
 * `features/reproduction/types.ts`, deliberately not imported to avoid a dependency on that
 * feature's in-progress lane). */
export interface PurchasedLactationResult {
  id: string;
  cattleId: string;
  lactationNumber: number;
  startDate: string;
  isEstimated: boolean;
  estimatedDaysInMilk: number | null;
  estimatedLactationNumber: number | null;
}

// ---- RFE-024 — Cattle CSV import (`cattle-import.service.ts`) -------------------------------------

/** One row of a `POST /cattle/import/preview` response. */
export interface CattleImportRow {
  row: number;
  name: string | null;
  tag: string | null;
  status: "ready" | "error";
  error?: string;
}

/** `POST /cattle/import/preview` response — cached server-side under `importSessionId` (30 min TTL). */
export interface CattleImportPreview {
  importSessionId: string;
  total: number;
  ready: number;
  errors: number;
  rows: CattleImportRow[];
}

/** `POST /cattle/import/confirm` response. */
export interface CattleImportConfirmResult {
  imported: number;
  skipped: number;
}
