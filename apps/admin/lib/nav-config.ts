import {
  Activity,
  BadgeDollarSign,
  BarChart3,
  Building2,
  LayoutDashboard,
  ScrollText,
  Send,
  ShieldCheck,
  SlidersHorizontal,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavGroupKey = "overview" | "directory" | "security" | "platform";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  group: NavGroupKey;
  /** Admin permission key, e.g. "farm.read". Omit for items every admin may see. */
  perm?: string;
}

export const NAV_GROUPS: { key: NavGroupKey; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "directory", label: "Directory" },
  { key: "security", label: "Security" },
  { key: "platform", label: "Platform" },
];

/** Single source for sidebar / mobile nav. Gating here is UX only; the API enforces authorization. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard, group: "overview" },
  { href: "/farms", label: "Farms", icon: Building2, group: "directory", perm: "farm.read" },
  { href: "/users", label: "Users", icon: Users, group: "directory", perm: "user.read" },
  { href: "/communications", label: "Outreach & Broadcast", icon: Send, group: "directory", perm: "user.manage" },
  { href: "/security", label: "Security", icon: ShieldCheck, group: "security", perm: "security.read" },
  { href: "/audit", label: "Audit log", icon: ScrollText, group: "security", perm: "audit.read" },
  { href: "/plans", label: "Plans", icon: BadgeDollarSign, group: "platform", perm: "plan.read" },
  { href: "/analytics", label: "Analytics", icon: BarChart3, group: "platform", perm: "analytics.read" },
  { href: "/system", label: "System", icon: Activity, group: "platform", perm: "system.read" },
  { href: "/config", label: "Config", icon: SlidersHorizontal, group: "platform", perm: "config.read" },
];
