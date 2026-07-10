import {
  Activity,
  BarChart3,
  Beef,
  Boxes,
  CalendarHeart,
  Home,
  ListChecks,
  Milk,
  PawPrint,
  Settings,
  Sparkles,
  Stethoscope,
  Store,
  Wallet,
  Wheat,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  /** Key into the `nav` i18n namespace. */
  labelKey: string;
  href: string;
  icon: LucideIcon;
  /** Gates visibility on the subscription plan (RFE-008 wires the real flag check). */
  premiumFlag?: string;
}

/** Sidebar module list per PRD §6.1 — order matches the daily-driver workflow, Scoreboard last (V1.5). */
export const navItems: NavItem[] = [
  { labelKey: "dashboard", href: "/dashboard", icon: Home },
  { labelKey: "cattle", href: "/cattle", icon: Beef },
  { labelKey: "milk", href: "/milk", icon: Milk },
  { labelKey: "buyers", href: "/buyers", icon: Store },
  { labelKey: "reproduction", href: "/reproduction", icon: CalendarHeart },
  { labelKey: "calves", href: "/calves", icon: PawPrint },
  { labelKey: "healthcare", href: "/healthcare", icon: Stethoscope },
  { labelKey: "feedFormulator", href: "/feed", icon: Wheat },
  { labelKey: "inventory", href: "/inventory", icon: Boxes },
  { labelKey: "finance", href: "/finance", icon: Wallet },
  { labelKey: "taskHub", href: "/tasks", icon: ListChecks },
  { labelKey: "reports", href: "/reports", icon: BarChart3 },
  { labelKey: "activityLog", href: "/activity", icon: Activity },
  { labelKey: "scoreboard", href: "/scoreboard", icon: Sparkles, premiumFlag: "scoreboard.read" },
  { labelKey: "settings", href: "/settings", icon: Settings },
];
