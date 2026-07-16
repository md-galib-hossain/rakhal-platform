"use client"; // URL-synced tab state

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, PieChart, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import { FINANCE_TABS, type FinanceTabKey } from "../types";

const TAB_KEYS = FINANCE_TABS.map((t) => t.key) as [FinanceTabKey, ...FinanceTabKey[]];

/** Figma "Finance" tab bar (node 1039:33905, file `SCfMPdxP6vgW1uTxfqCtz7`) reuses one generic
 * decorative "package" icon for every tab — real semantically-matched `lucide-react` icons used
 * instead here, same precedent as the Task Hub/Activity Log tickets on this board. */
const TAB_ICONS: Record<FinanceTabKey, React.ComponentType<{ className?: string }>> = {
  ledger: Receipt,
  receivables: ArrowDownToLine,
  payables: ArrowUpFromLine,
  liabilities: AlertTriangle,
  assets: PieChart,
};

export function FinanceTabs() {
  const t = useTranslations("finance.tabs");
  const [tab, setTab] = useQueryState("tab", parseAsStringEnum<FinanceTabKey>(TAB_KEYS).withDefault("ledger"));

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
  const [tab] = useQueryState("tab", parseAsStringEnum<FinanceTabKey>(TAB_KEYS).withDefault("ledger"));
  return tab;
}
