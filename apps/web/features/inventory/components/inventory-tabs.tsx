"use client"; // URL-synced tab state

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Box, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { INVENTORY_TABS, type InventoryTabKey } from "../types";

const TAB_KEYS = INVENTORY_TABS.map((t) => t.key) as [InventoryTabKey, ...InventoryTabKey[]];

/** Segmented pill tab bar (Figma "Inventory" frame 732:12409, node "Frame 1147") over the 5
 * inventory categories, plus a grid/list view toggle on the same row (Figma node "Frame 1173").
 * Both URL-synced (`?tab=`/`?view=`) so a tab+view combo is bookmarkable. */
export function InventoryTabs({
  view,
  onViewChange,
}: {
  view: "table" | "grid";
  onViewChange: (view: "table" | "grid") => void;
}) {
  const t = useTranslations("inventory.tabs");
  const [tab, setTab] = useQueryState("tab", parseAsStringEnum<InventoryTabKey>(TAB_KEYS).withDefault("medicine"));

  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted p-1.5">
      <div className="flex flex-wrap items-center gap-1">
        {INVENTORY_TABS.map(({ key }) => (
          <button
            key={key}
            type="button"
            onClick={() => void setTab(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-4 py-1.5 text-sm font-medium transition-colors",
              tab === key
                ? "bg-card text-primary shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Box className="size-[18px]" aria-hidden />
            {t(key)}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-0.5 rounded-lg bg-card p-0.5 shadow-sm">
        <button
          type="button"
          onClick={() => onViewChange("grid")}
          aria-label={t("gridView")}
          aria-pressed={view === "grid"}
          className={cn(
            "flex size-[30px] items-center justify-center rounded-md transition-colors",
            view === "grid" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <LayoutGrid className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => onViewChange("table")}
          aria-label={t("tableView")}
          aria-pressed={view === "table"}
          className={cn(
            "flex size-[30px] items-center justify-center rounded-md transition-colors",
            view === "table" ? "bg-primary text-white" : "text-muted-foreground hover:text-foreground",
          )}
        >
          <List className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

export function useActiveInventoryTab(): InventoryTabKey {
  const [tab] = useQueryState("tab", parseAsStringEnum<InventoryTabKey>(TAB_KEYS).withDefault("medicine"));
  return tab;
}
