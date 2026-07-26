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
