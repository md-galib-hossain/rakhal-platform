import {
  Activity,
  BarChart3,
  Beef,
  CalendarHeart,
  LayoutDashboard,
  ListChecks,
  Milk,
  Receipt,
  Settings,
  ShoppingCart,
  Syringe,
  Trophy,
  Utensils,
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
  | "finance"
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
  { key: "finance", labelKey: "groupFinance" },
  { key: "insights", labelKey: "groupInsights" },
  { key: "workspace", labelKey: "groupWorkspace" },
  { key: "system", labelKey: "groupSystem" },
];

/** Sidebar module list per PRD §6.1, grouped per the IA above.
 * RAKHAL-381 (MILESTONE 22 — Business Operations IA, `BUSINESS_IA_PRD.md` §4.2): Business narrows
 * to the commercial-document modules (Sales · Purchasing · Inventory); Finance (money) splits into
 * its own `finance` group, ordered right after Business. Buyers is a tab of Sales and Suppliers a tab
 * of Purchasing (2026-10-19 merge) — `/buyers` and `/suppliers` redirect there. */
export const navItems: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard, group: "overview" },
  { labelKey: "animals", href: "/animals", icon: Beef, group: "herdManagement" },
  { labelKey: "reproduction", href: "/reproduction", icon: CalendarHeart, group: "herdManagement" },
  { labelKey: "healthcare", href: "/healthcare", icon: Syringe, group: "herdManagement" },
  { labelKey: "milk", href: "/milk", icon: Milk, group: "production" },
  { labelKey: "feeding", href: "/feeding", icon: Utensils, group: "production" },
  { labelKey: "feedFormulator", href: "/feed", icon: Wheat, group: "production" },
  { labelKey: "sales", href: "/sales", icon: Receipt, group: "business" },
  { labelKey: "purchasing", href: "/purchasing", icon: ShoppingCart, group: "business" },
  { labelKey: "inventory", href: "/inventory", icon: Warehouse, group: "business" },
  { labelKey: "finance", href: "/finance", icon: Wallet, group: "finance" },
  { labelKey: "scoreboard", href: "/scoreboard", icon: Trophy, group: "insights", premiumFlag: "scoreboard.read" },
  { labelKey: "reports", href: "/reports", icon: BarChart3, group: "insights" },
  { labelKey: "taskHub", href: "/tasks", icon: ListChecks, group: "workspace" },
  { labelKey: "activityLog", href: "/activity", icon: Activity, group: "system" },
  { labelKey: "settings", href: "/settings", icon: Settings, group: "system" },
];
