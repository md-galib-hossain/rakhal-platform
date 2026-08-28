"use client"; // URL-synced tab state

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { ArrowDownToLine, ArrowUpFromLine, BarChart3, LayoutDashboard, Receipt, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { FINANCE_TABS, type FinanceTabKey } from "../types";

const TAB_KEYS = FINANCE_TABS.map((t) => t.key) as [FinanceTabKey, ...FinanceTabKey[]];

/** RAKHAL-382 flattened tab bar (`BUSINESS_IA_PRD.md` §4.3) — real semantically-matched
 * `lucide-react` icons, same precedent the old Figma-tab-bar mapping already established. */
const TAB_ICONS: Record<FinanceTabKey, React.ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  transactions: Receipt,
  receivables: ArrowDownToLine,
  payables: ArrowUpFromLine,
  accounts: Wallet,
  reports: BarChart3,
};

export function FinanceTabs() {
  const t = useTranslations("finance.tabs");
  const [tab, setTab] = useQueryState("tab", parseAsStringEnum<FinanceTabKey>(TAB_KEYS).withDefault("overview"));

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted p-1.5">
      {FINANCE_TABS.map(({ key }) => {
        const Icon = TAB_ICONS[key];
        return (
          <button
            key={key}
            type="button"
            onClick={() => void setTab(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-sm px-4 py-1.5 text-sm font-medium transition-colors",
              tab === key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
            {t(key)}
          </button>
        );
      })}
    </div>
  );
}

export function useActiveFinanceTab(): FinanceTabKey {
  const [tab] = useQueryState("tab", parseAsStringEnum<FinanceTabKey>(TAB_KEYS).withDefault("overview"));
  return tab;
}
