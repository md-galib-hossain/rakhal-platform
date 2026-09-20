/** Settings tab-rail (Figma `1039:51236`). `billing` (RFE-036) and `team` (this pass) have real
 * content; `workspace`/`modules` are the rest of RFE-045 and render a placeholder for now. */
export const SETTINGS_TABS = ["workspace", "team", "modules", "billing"] as const;

export type SettingsTabKey = (typeof SETTINGS_TABS)[number];

/** `GET /settings/team` — members and pending invites merged into one list. */
export interface TeamRow {
  id: string;
  member_id?: string;
  invite_id?: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  role: string;
  status: "active" | "pending" | "expired" | "revoked";
  last_active_at: string | null;
  expires_at?: string;
  is_owner?: boolean;
}

export interface TeamListResult {
  members: TeamRow[];
}

/** One resource's grantable actions (`buildCatalogue()` in the backend's `permission-matrix.ts`).
 * Wildcard keys (`*`, `resource.*`) are excluded from the catalogue — they are a *storage*
 * form, expanded into concrete actions by `matrix` below. */
export interface PermissionCatalogueEntry {
  /** Permission group the resource belongs to, e.g. `CATTLE`. Used to section the grid. */
  group: string;
  /** Resource segment of the key, e.g. `cattle`. */
  resource: string;
  /** Concrete actions, e.g. `["read","create","update","delete"]`. */
  actions: string[];
}

/** `resource -> action -> granted`. Wildcards are already expanded, so the Owner role's
 * single stored `*` arrives here as every action set to `true`. */
export type PermissionMatrix = Record<string, Record<string, boolean>>;

export interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  /** System templates are global rows shared by every farm, so they are never editable —
   * a farm customises by creating its own role instead. */
  editable: boolean;
  member_count: number;
  permission_keys: string[];
  matrix: PermissionMatrix;
}

export interface RoleListResult {
  roles: RoleOption[];
  /** Ships with the list so the editor can render the whole grid from one response. */
  catalogue: PermissionCatalogueEntry[];
}

export interface PermissionCatalogueResult {
  permissions: PermissionCatalogueEntry[];
}

export type RoleBase = "owner" | "manager" | "worker";

/** `GET/PATCH /settings/farm` (`SettingsService#getFarm`/`mapFarm` — verified against backend source,
 * not the (stale) API doc sample: also returns `farm_slug`/`status`/`phone`/`address`, the latter two
 * read-only here since their mutation path is `PATCH /billing/profile`). */
export interface FarmSettings {
  farm_id: string;
  farm_slug: string;
  farm_name: string;
  description: string | null;
  division: string | null;
  district: string | null;
  upazila: string | null;
  operational_purpose: string | null;
  status: string;
  phone: string | null;
  address: string | null;
}

export type ShedPurpose = "MILKING" | "HEIFER" | "DRY" | "CALF" | "QUARANTINE" | "GENERAL";

/** `GET /settings/sheds` row — the list route returns a bare array, not `{sheds: []}` (API doc sample
 * is stale; `SettingsController#listSheds` returns the service result directly). */
export interface Shed {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  capacity: number | null;
  purpose: ShedPurpose | null;
  responsible_member: { id: string; name: string } | null;
  current_count: number;
  deleted_at: string | null;
  created_at: string;
}

export type ShedListResult = Shed[];

/** `GET /settings/feed-groups` row — bare array like sheds (`SettingsController#listFeedGroups`). */
export interface FeedGroup {
  id: string;
  name: string;
  description: string | null;
  /** Target refusal (leftover) as a % of what was offered. The backend has always returned
   * this and accepted it on create/update; the old Settings dialog just never showed it. */
  refusal_target_pct: number | null;
  /** The group's default Total Mixed Ration, used by "Feed Today" on `/feeding`. */
  default_concentration_id: string | null;
  /** RAKHAL-433/RFE-116 (Feeding Favourites): this group's default Feeding Grid source — the
   * resolution ladder's own fallback once a cow has no usable last-used source. Separate from
   * `default_concentration_id` above, which stays reserved for the one-click "Feed Today" TMR. */
  default_feed_source_type: "FEED_ITEM" | "FEED_STOCK" | null;
  default_feed_item_id: string | null;
  default_feed_stock_id: string | null;
  deleted_at: string | null;
  assigned_count: number;
  created_at: string;
}

export type FeedGroupListResult = FeedGroup[];

/** `GET/POST/PATCH /settings/suppliers` row (`WorkspaceSettingsService#mapSupplier`, RAKHAL-032). */
export interface Supplier {
  id: string;
  name: string;
  contact: string | null;
  phone: string | null;
  category: string | null;
  payment_terms: string | null;
  notes: string | null;
  deleted_at: string | null;
}

export interface SupplierListResult {
  suppliers: Supplier[];
}

export type ServiceProviderType = "AI_TECHNICIAN" | "VETERINARIAN" | "OTHER";

/** `GET/POST/PATCH /settings/service-providers` row (`WorkspaceSettingsService#mapServiceProvider`).
 * Farm-scoped contact directory for AI technicians/vets, referenced by `BreedingEvent.serviceProviderId`
 * when Reproduction's Record AI form uses `semenSource: "TECHNICIAN_SUPPLIED"`. */
export interface ServiceProvider {
  id: string;
  name: string;
  phone: string | null;
  type: ServiceProviderType;
  deleted_at: string | null;
}

export interface ServiceProviderListResult {
  service_providers: ServiceProvider[];
}
