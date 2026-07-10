import {
  Activity,
  BarChart3,
  Beef,
  CalendarHeart,
  LayoutDashboard,
  ListChecks,
  Milk,
  PawPrint,
  Settings,
  Store,
  Syringe,
  Trophy,
  Wallet,
  Warehouse,
  Wheat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type NavGroupKey =
  | "overview"
  | "herdManagement"
  | "production"
  | "business"
  | "insights"
  | "workspace"
  | "system";

export interface NavItem {
  /** Key into the `nav` i18n namespace. */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  group: NavGroupKey;
  /** Gates visibility on the subscription plan (RFE-008 wires the real flag check). */
  premiumFlag?: string;
}

/** Ordered groups for the sidebar's grouped IA (2026-07-10 user design pass — replaces the flat
 * Figma MENU/OTHERS split with a task-oriented grouping so 15 modules don't read as one long list).
 * Groups are static for now; the design calls out collapsibility as a later enhancement. */
export const navGroups: { key: NavGroupKey; labelKey: string }[] = [
  { key: "overview", labelKey: "groupOverview" },
  { key: "herdManagement", labelKey: "groupHerdManagement" },
  { key: "production", labelKey: "groupProduction" },
  { key: "business", labelKey: "groupBusiness" },
  { key: "insights", labelKey: "groupInsights" },
  { key: "workspace", labelKey: "groupWorkspace" },
  { key: "system", labelKey: "groupSystem" },
];

/** Sidebar module list per PRD §6.1, grouped per the IA above. */
export const navItems: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard, group: "overview" },
  { labelKey: "cattle", href: "/cattle", icon: Beef, group: "herdManagement" },
  { labelKey: "reproduction", href: "/reproduction", icon: CalendarHeart, group: "herdManagement" },
  { labelKey: "calves", href: "/calves", icon: PawPrint, group: "herdManagement" },
  { labelKey: "healthcare", href: "/healthcare", icon: Syringe, group: "herdManagement" },
  { labelKey: "milk", href: "/milk", icon: Milk, group: "production" },
  { labelKey: "feedFormulator", href: "/feed", icon: Wheat, group: "production" },
  { labelKey: "buyers", href: "/buyers", icon: Store, group: "business" },
  { labelKey: "finance", href: "/finance", icon: Wallet, group: "business" },
  { labelKey: "inventory", href: "/inventory", icon: Warehouse, group: "business" },
  { labelKey: "scoreboard", href: "/scoreboard", icon: Trophy, group: "insights", premiumFlag: "scoreboard.read" },
  { labelKey: "reports", href: "/reports", icon: BarChart3, group: "insights" },
  { labelKey: "taskHub", href: "/tasks", icon: ListChecks, group: "workspace" },
  { labelKey: "activityLog", href: "/activity", icon: Activity, group: "system" },
  { labelKey: "settings", href: "/settings", icon: Settings, group: "system" },
];
