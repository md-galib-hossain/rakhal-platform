"use client"; // URL-synced tab state

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { ArrowDownToLine, ArrowUpFromLine, BarChart3, LayoutDashboard, Receipt, Wallet } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@rakhal/ui/ui/tabs";
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
    <Tabs value={tab} onValueChange={(v) => void setTab(v as FinanceTabKey)}>
      <TabsList className="h-auto flex-wrap sm:h-11">
        {FINANCE_TABS.map(({ key }) => {
          const Icon = TAB_ICONS[key];
          return (
            <TabsTrigger key={key} value={key}>
              <Icon className="mr-1.5 size-4" aria-hidden />
              {t(key)}
            </TabsTrigger>
          );
        })}
      </TabsList>
    </Tabs>
  );
}

export function useActiveFinanceTab(): FinanceTabKey {
  const [tab] = useQueryState("tab", parseAsStringEnum<FinanceTabKey>(TAB_KEYS).withDefault("overview"));
  return tab;
}
