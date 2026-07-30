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

export interface RoleOption {
  id: string;
  name: string;
  description: string | null;
  is_system: boolean;
  editable: boolean;
  member_count: number;
}

export interface RoleListResult {
  roles: RoleOption[];
}

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
  is_active: boolean;
  created_at: string;
}

export type ShedListResult = Shed[];

/** `GET /settings/feed-groups` row — bare array like sheds (`SettingsController#listFeedGroups`). */
export interface FeedGroup {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  assigned_count: number;
  created_at: string;
}

export type FeedGroupListResult = FeedGroup[];
