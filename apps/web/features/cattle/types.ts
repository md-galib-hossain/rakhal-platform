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
/** RAKHAL-399: matches backend `HerdStatus` exactly (`cattle.enums.prisma`) — was previously stale
 * (`DEAD`/`TRANSFERRED`/`MISSING`/`ARCHIVED` never existed backend-side; `TRANSFERRED` folds into
 * `SOLD`, plain archive is `deletedAt`, not a status value). */
export type CattleStatus = "ACTIVE" | "SOLD" | "CULLED" | "DECEASED";
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

/** RAKHAL-452 — a named, farm-defined set of animals (many-to-many); `GET /animal-groups`. */
export interface AnimalGroup {
  id: string;
  name: string;
  description: string | null;
  memberCount: number;
  createdAt?: string;
  deletedAt?: string | null;
}

/** RAKHAL-401 — derived lifecycle sub-stage nested under `animalCategory` (HEIFER/BULL only;
 * null for CALF/COW/STEER or an unset `dateOfBirth`). */
export type LifecycleSubStage =
  | "WEANED_HEIFER"
  | "GROWING_HEIFER"
  | "BREEDING_HEIFER"
  | "WEANER_BULL"
  | "GROWING_BULL"
  | "MATURE_BULL";

/** RAKHAL-474/475 (MILESTONE 30) — `GET /cattle` row `next_event` and `GET /cattle/:id/upcoming-events`
 * `events[]`. The server sends an i18n key (`labelKey`, e.g. `cattle.upcoming.healthStep`) plus params, never
 * an English string; `WEANING` is reserved and not emitted yet. */
export type UpcomingEventKind =
  | "HEALTH_STEP"
  | "PREVENTIVE_STEP"
  | "PREGNANCY_CHECK"
  | "CALVING"
  | "DRY_OFF"
  | "TASK"
  | "WITHDRAWAL_END"
  | "WEANING";

export type UpcomingEventUrgency = "OVERDUE" | "DUE_SOON" | "LATER";

export interface UpcomingEvent {
  kind: UpcomingEventKind;
  labelKey: string;
  labelParams?: Record<string, string | number>;
  /** ISO instant. */
  dueAt: string;
  /** Whole farm-local days from today; negative once past. */
  daysUntil: number;
  urgency: UpcomingEventUrgency;
  /** `false` for information only (a withdrawal ending). */
  actionable: boolean;
  ref: { type: string; id: string };
}

export interface UpcomingEventsResult {
  events: UpcomingEvent[];
  /** Everything in the window, before the `limit` cap. */
  total: number;
}

/** `GET /cattle?dueFilter=` — animals with an actionable event before today / today / the next 7 days. */
export type DueFilter = "overdue" | "today" | "week";

export interface CattleListItem {
  id: string;
  name: string | null;
  tagNumber: string;
  gender: CattleGender;
  dateOfBirth: string | null;
  /** Wire field is `herdStatus` (raw Prisma column, `composeStatus()` spreads the row as-is) —
   * was mis-typed as `status` before (always `undefined` on the wire as a result, silently
   * breaking every "is this animal active" gate: `RecordSaleTrigger`/dispose visibility never
   * actually worked). Fixed alongside relocating dispose into `CattleDetailSheet` (no ticket #). */
  herdStatus: CattleStatus;
  /** RAKHAL-400 — `deletedAt`/soft-delete is a separate dimension from `herdStatus`
   * (disposition): a SOLD/CULLED/DECEASED animal has left the active herd but keeps its real
   * history; `deletedAt` set means the *record itself* was removed (duplicate/mistake). Only a
   * `deletedAt`-set row is restorable — `restore()` clears `deletedAt` only, it never resets
   * `herdStatus` back to ACTIVE. */
  deletedAt: string | null;
  /** Nullable since RAKHAL-269 v2: immature/never-milked animals (and dry-period animals before
   * their first freshening) carry no production state. */
  productionStatus: ProductionStatus | null;
  shedId: string | null;
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
  /** RAKHAL-401 — see `LifecycleSubStage` doc comment above. */
  lifecycleSubStage: LifecycleSubStage | null;
  reproductionAlerts: ReproductionAlert[];
  lactationStage: LactationStage | null;
  pregnancyStage: PregnancyStage | null;
  /** Snake_case on the wire — see the header comment. */
  profile_photo: MediaUrls | null;
  /** RAKHAL-475 — the single most urgent upcoming event (or null), and how many are in the window
   * (next 14 farm days plus everything overdue). Snake_case on the wire. */
  next_event: UpcomingEvent | null;
  upcoming_event_count: number;
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
  animalGroupId?: string;
  productionStatus?: ProductionStatus;
  healthStatus?: HealthStatusFilter;
  reproductiveStatus?: ReproductiveStatus;
  /** RAKHAL-289 — real derived-category filter now supported server-side
   * (`ListCattleQueryDto.animalCategory`, `list-cattle-query.dto.ts`). */
  animalCategory?: AnimalCategory;
  /** RAKHAL-402 — herd status filter (`ListCattleQueryDto.status`). Defaults to ACTIVE
   * server-side when omitted, same as before this filter existed. */
  status?: CattleStatus;
  /** RAKHAL-401 — lifecycle sub-stage filter (`ListCattleQueryDto.lifecycleSubStage`). */
  lifecycleSubStage?: LifecycleSubStage;
  /** RAKHAL-475 — animals with an actionable upcoming event (`ListCattleQueryDto.dueFilter`). */
  dueFilter?: DueFilter;
}

export const BULK_ACTIONS = ["change_shed", "mark_sold", "dispose", "export"] as const;
export type BulkAction = (typeof BULK_ACTIONS)[number];

/** Bulk `dispose` covers all 3 lifecycle exits in one dialog (sell/cull/dead) — replaces the old
 * `mark_sold`-only bulk button (UX request, no ticket #). `mark_sold` stays wired backend-side for
 * compat but the UI no longer offers it directly. */
export type BulkDisposeType = "SALE" | "CULL" | "DEATH";

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
}

/** `POST/PATCH /cattle(/:id)` body — mirrors `CreateCattleDto`/`UpdateCattleDto`. */
export interface CattleFormPayload {
  name?: string;
  tagNumber: string;
  breedId?: string;
  gender: CattleGender;
  dateOfBirth?: string;
  shedId?: string;
  animalGroupId?: string;
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
  /** RAKHAL-319-F — mirrors `CreateCattleDto.intakeBreeding`/`intakeHeat` (`IntakeBreedingDto`/
   * `IntakeHeatDto`). Create-only, mutually exclusive, sent by `cattle-form-dialog.tsx`'s
   * `toPayload()` based on the local `intakeReproductionMode` toggle. */
  intakeBreeding?: { breedingDate: string; breedingMethod?: "AI" | "NATURAL" | "EMBRYO_TRANSFER"; notes?: string };
  intakeHeat?: { heatDateTime: string; notes?: string };
  /** MILESTONE 31 / RFE-162 — what the "Her history" step collected; the server turns each answer into a backdated
   * HISTORICAL event. Create-only. Until the server accepts it the dialog sends the fields below instead. */
  history?: HistoryPayload;
  /** Existing intake fields (`CreateCattleDto`) the history step falls back to; see `toLegacyIntake`. */
  productionStatus?: "MILKING" | "DRY";
  lactationStartDate?: string;
  dryOffStartDate?: string;
  intakePregnancy?: { conceptionDate?: string; expectedCalvingDate?: string };
}

/** RFE-162 — one `history` entry of `POST /cattle` (`HistoryItemDto`, backend `intake.dto.ts`): the server accepts exactly these
 * properties, so there is no `approx` flag; a month-only answer is sent as the middle of that month. */
export type HistoryItem =
  | { kind: "LAST_CALVING"; date: string; calvingNumber?: number }
  | { kind: "LAST_BREEDING"; date: string; method?: "AI" | "NATURAL" | "EMBRYO_TRANSFER"; bull?: string }
  | { kind: "PREGNANT"; expectedCalvingDate?: string; monthsPregnant?: number }
  | { kind: "MILKING_SINCE"; date: string }
  | { kind: "DRY_SINCE"; date: string }
  | { kind: "LAST_VACCINATION"; date: string; product?: string };

export type HistoryPayload = HistoryItem[];

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
