"use client"; // URL-synced tab state

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Box, LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@rakhal/ui/ui/tabs";
import { INVENTORY_TABS, type InventoryTabKey } from "../types";

const TAB_KEYS = INVENTORY_TABS.map((t) => t.key) as [InventoryTabKey, ...InventoryTabKey[]];

/** Segmented pill tab bar (Figma "Inventory" frame 732:12409, node "Frame 1147") over the 5
 * inventory categories, plus a grid/list view toggle on the same row (Figma node "Frame 1173")
 * displayed only for tabs that provide dual table/grid layouts (Medicine, Feed, Others/Equipment).
 * Both URL-synced (`?tab=`/`?view=`) so a tab+view combo is bookmarkable. */
export function InventoryTabs({
  view,
  onViewChange,
  showViewToggle: showViewToggleProp,
}: {
  view: "table" | "grid";
  onViewChange: (view: "table" | "grid") => void;
  showViewToggle?: boolean;
}) {
  const t = useTranslations("inventory.tabs");
  const [tab, setTab] = useQueryState("tab", parseAsStringEnum<InventoryTabKey>(TAB_KEYS).withDefault("medicine"));
  const activeTabConfig = INVENTORY_TABS.find((t) => t.key === tab);
  const showViewToggle = showViewToggleProp ?? (activeTabConfig?.hasViewToggle ?? false);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Tabs value={tab} onValueChange={(v) => void setTab(v as InventoryTabKey)}>
        <TabsList className="h-auto flex-wrap sm:h-11">
          {INVENTORY_TABS.map(({ key }) => (
            <TabsTrigger key={key} value={key}>
              <Box className="mr-1.5 size-4" aria-hidden />
              {t(key)}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {showViewToggle ? (
        <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5 shadow-xs">
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
      ) : null}
    </div>
  );
}

export function useActiveInventoryTab(): InventoryTabKey {
  const [tab] = useQueryState("tab", parseAsStringEnum<InventoryTabKey>(TAB_KEYS).withDefault("medicine"));
  return tab;
}
