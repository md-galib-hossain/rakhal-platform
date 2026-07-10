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

export interface NavItem {
  /** Key into the `nav` i18n namespace. */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  /** Sidebar section — mirrors the Figma "Navbar" frame's MENU/OTHERS grouping. */
  section: "menu" | "others";
  /** Gates visibility on the subscription plan (RFE-008 wires the real flag check). */
  premiumFlag?: string;
}

/**
 * Sidebar module list per PRD §6.1, grouped to match the Figma "Navbar" frame (file
 * SCfMPdxP6vgW1uTxfqCtz7, node 732:1659): MENU has the daily-driver workflow modules, OTHERS has
 * Activity Log + Settings. The Figma prototype only pictures 9 of our 15 modules (deliberately
 * incomplete, DESIGN_SYSTEM.md §1) — Buyers/Reproduction/Calves/Reports are ours, slotted into MENU
 * next to their closest sibling rather than dropped.
 */
export const navItems: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: LayoutDashboard, section: "menu" },
  { labelKey: "cattle", href: "/cattle", icon: Beef, section: "menu" },
  { labelKey: "feedFormulator", href: "/feed", icon: Wheat, section: "menu" },
  { labelKey: "milk", href: "/milk", icon: Milk, section: "menu" },
  { labelKey: "buyers", href: "/buyers", icon: Store, section: "menu" },
  { labelKey: "finance", href: "/finance", icon: Wallet, section: "menu" },
  { labelKey: "healthcare", href: "/healthcare", icon: Syringe, section: "menu" },
  { labelKey: "reproduction", href: "/reproduction", icon: CalendarHeart, section: "menu" },
  { labelKey: "calves", href: "/calves", icon: PawPrint, section: "menu" },
  { labelKey: "inventory", href: "/inventory", icon: Warehouse, section: "menu" },
  { labelKey: "scoreboard", href: "/scoreboard", icon: Trophy, section: "menu", premiumFlag: "scoreboard.read" },
  { labelKey: "taskHub", href: "/tasks", icon: ListChecks, section: "menu" },
  { labelKey: "reports", href: "/reports", icon: BarChart3, section: "menu" },
  { labelKey: "activityLog", href: "/activity", icon: Activity, section: "others" },
  { labelKey: "settings", href: "/settings", icon: Settings, section: "others" },
];
