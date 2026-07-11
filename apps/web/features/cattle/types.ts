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
export type CattleStatus = "ACTIVE" | "SOLD" | "DEAD" | "TRANSFERRED" | "MISSING" | "ARCHIVED";
export type ProductionStatus = "MILKING" | "DRY" | "FRESH" | "GROWING" | "SOLD" | "DECEASED";
export type ReproductiveStatus =
  | "HEIFER"
  | "OPEN"
  | "BRED"
  | "PREGNANT"
  | "DRY"
  | "LACTATING"
  | "POSTPARTUM"
  | "ABORTED"
  | "RETIRED";
export type HealthStatusFilter = "HEALTHY" | "SICK" | "IN_TREATMENT" | "WITHHOLDING" | "QUARANTINE";

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
  productionStatus: ProductionStatus;
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
}
