"use client"; // URL-synced tab state (nuqs)

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Bell, BellRing, Building2, CreditCard, KeySquare, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/shared/empty-state";
import { BillingSettingsView } from "@/features/subscription/components/billing/billing-settings-view";
import { FollowUpRulesView } from "./follow-up-rules-view";
import { NotificationSettingsLink } from "./notification-settings-link";
import { ModulesSettingsView } from "./modules-settings-view";
import { TeamSettingsView } from "./team-settings-view";
import { WorkspaceSettingsView } from "./workspace-settings-view";
import { SETTINGS_TABS, type SettingsTabKey } from "../types";

const TAB_KEYS = [...SETTINGS_TABS] as [SettingsTabKey, ...SettingsTabKey[]];

/** Figma reuses one generic "package" glyph for every tab — real semantically-matched icons used
 * here instead, same precedent as Finance/Task Hub on this board. */
const TAB_ICONS: Record<SettingsTabKey, React.ComponentType<{ className?: string }>> = {
  workspace: Building2,
  team: KeySquare,
  modules: SlidersHorizontal,
  billing: CreditCard,
  notifications: Bell,
  followUps: BellRing,
};

/**
 * Settings vertical tab-rail (Figma `1039:51236`) + routed content. `billing`/`team`/`workspace`
 * have real content (RFE-036/RFE-045a); `modules` now covers Suppliers CRUD (RFE-045c) — its
 * remaining Module-toggle editor (RFE-045b) is still a placeholder, see `ModulesSettingsView`'s
 * own doc comment.
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
        ) : tab === "workspace" ? (
          <WorkspaceSettingsView />
        ) : tab === "modules" ? (
          <ModulesSettingsView />
        ) : tab === "followUps" ? (
          <FollowUpRulesView />
        ) : tab === "notifications" ? (
          <NotificationSettingsLink />
        ) : (
          <EmptyState title={t("comingSoon")} description={t("comingSoonDescription")} />
        )}
      </div>
    </div>
  );
}
