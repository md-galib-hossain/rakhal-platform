import { Beef, FileText, HeartPulse, type LucideIcon, Milk, Syringe, Warehouse, Wallet } from "lucide-react";
import type { ActivityModule } from "./types";

export interface ModuleStyle {
  /** `components/ui/chip.tsx` variant — reused for both the module chip and the icon tint. */
  variant: "info" | "teal" | "destructive" | "primary" | "purple" | "indigo" | "muted";
  icon: LucideIcon;
  iconBg: string;
  iconFg: string;
}

/** Figma's mock reuses one generic "package" placeholder icon tinted per-module (734:50995) —
 * kept real, semantically-matched `lucide-react` icons per module instead (same precedent as the
 * sidebar nav build, `DESIGN_SYSTEM.md` §4 "Nav item set"). Colors match the Figma frame exactly
 * where it pictures one: Cow Management = blue, Milk Production = cyan, Health & Safety = rose,
 * Finance = green. Breeding/Inventory/General aren't pictured — assigned the closest unused
 * semantic tokens rather than inventing new hexes. */
export const MODULE_STYLE: Record<ActivityModule, ModuleStyle> = {
  COW_MANAGEMENT: { variant: "info", icon: Beef, iconBg: "bg-info-tint", iconFg: "text-info" },
  MILK_PRODUCTION: { variant: "teal", icon: Milk, iconBg: "bg-accent-teal-tint", iconFg: "text-accent-teal" },
  HEALTH_SAFETY: { variant: "destructive", icon: Syringe, iconBg: "bg-destructive-tint", iconFg: "text-destructive" },
  FINANCE: { variant: "primary", icon: Wallet, iconBg: "bg-success-tint", iconFg: "text-success" },
  BREEDING: { variant: "purple", icon: HeartPulse, iconBg: "bg-accent-purple-tint", iconFg: "text-accent-purple" },
  INVENTORY: { variant: "indigo", icon: Warehouse, iconBg: "bg-accent-indigo-tint", iconFg: "text-accent-indigo" },
  GENERAL: { variant: "muted", icon: FileText, iconBg: "bg-muted", iconFg: "text-muted-foreground" },
};
