import { Building2, LayoutDashboard, ScrollText, Users, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Admin permission key, e.g. "farm.read". Omit for items every admin may see. */
  perm?: string;
}

/** Single source for sidebar / mobile nav. Gating here is UX only; the API enforces authorization. */
export const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/farms", label: "Farms", icon: Building2, perm: "farm.read" },
  { href: "/users", label: "Users", icon: Users, perm: "user.read" },
  { href: "/audit", label: "Audit log", icon: ScrollText, perm: "audit.read" },
];
