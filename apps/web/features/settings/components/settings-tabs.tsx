"use client"; // URL-synced tab state (nuqs)

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Building2, CreditCard, KeySquare, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { BillingSettingsView } from "@/features/subscription/components/billing/billing-settings-view";
import { TeamSettingsView } from "./team-settings-view";
import { SETTINGS_TABS, type SettingsTabKey } from "../types";

const TAB_KEYS = [...SETTINGS_TABS] as [SettingsTabKey, ...SettingsTabKey[]];

/** Figma reuses one generic "package" glyph for every tab — real semantically-matched icons used
 * here instead, same precedent as Finance/Task Hub on this board. */
const TAB_ICONS: Record<SettingsTabKey, React.ComponentType<{ className?: string }>> = {
  workspace: Building2,
  team: KeySquare,
  modules: SlidersHorizontal,
  billing: CreditCard,
};

/**
 * Settings vertical tab-rail (Figma `1039:51236`) + routed content. Defaults to `billing` — the one
 * tab built this pass; the other three are placeholders until the rest of RFE-045 lands.
 */
export function SettingsTabs() {
  const t = useTranslations("settings");
  const [tab, setTab] = useQueryState("tab", parseAsStringEnum<SettingsTabKey>(TAB_KEYS).withDefault("billing"));

  return (
    <div className="flex flex-col gap-6 rounded-2xl bg-card p-4 shadow-card md:flex-row md:gap-8 md:p-6">
      <nav className="flex shrink-0 flex-row gap-1 overflow-x-auto md:w-60 md:flex-col" aria-label={t("title")}>
        {SETTINGS_TABS.map((key) => {
          const Icon = TAB_ICONS[key];
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => void setTab(key)}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                active ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              {t(`tabs.${key}`)}
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1 md:border-l md:border-border md:pl-8">
        {tab === "billing" ? (
          <BillingSettingsView />
        ) : tab === "team" ? (
          <TeamSettingsView />
        ) : (
          <EmptyState title={t("comingSoon")} description={t("comingSoonDescription")} />
        )}
      </div>
    </div>
  );
}
