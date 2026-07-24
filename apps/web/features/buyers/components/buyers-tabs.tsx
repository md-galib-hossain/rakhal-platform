"use client"; // URL-synced tab state

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Truck, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { BUYER_TABS, type BuyerTabKey } from "../types";
import { BuyersView } from "./buyers-view";
import { DispatchesView } from "./dispatches-view";

const TAB_KEYS = BUYER_TABS.map((t) => t.key) as [BuyerTabKey, ...BuyerTabKey[]];

const TAB_ICONS: Record<BuyerTabKey, React.ComponentType<{ className?: string }>> = {
  buyers: Users,
  dispatches: Truck,
};

export function BuyersTabs() {
  const t = useTranslations("buyers.tabs");
  const [tab, setTab] = useQueryState("tab", parseAsStringEnum<BuyerTabKey>(TAB_KEYS).withDefault("buyers"));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted p-1.5">
        {BUYER_TABS.map(({ key }) => {
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

      {tab === "buyers" ? <BuyersView /> : <DispatchesView />}
    </div>
  );
}
