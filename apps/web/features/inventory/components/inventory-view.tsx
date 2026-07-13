"use client"; // view-toggle state + active-tab read

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/empty-state";
import { InventoryTabs, useActiveInventoryTab } from "./inventory-tabs";
import { MedicineView } from "./medicine-view";
import { ForageView } from "./forage-view";
import { MilkView } from "./milk-view";
import { INVENTORY_TABS } from "../types";

/** Top-level Inventory page body — the 5-category tab bar + grid/list view toggle (Figma
 * "Inventory" frame 732:12409), routing to each tab's view. Medicine, Forage, and Milk have real
 * backed views so far (see `types.ts#INVENTORY_TABS` doc comment) — the remaining 2 tabs switch and
 * render an honest "not built yet" empty state instead of fabricated data. Milk has no grid/list
 * toggle of its own (Figma's "Inventory - Milk" frame is a single fixed layout, not a table/grid
 * pair like Medicine/Forage) — `view` is simply unused on that branch. */
export function InventoryView() {
  const t = useTranslations("inventory");
  const [view, setView] = useState<"table" | "grid">("table");
  const activeTab = useActiveInventoryTab();
  const tabConfig = INVENTORY_TABS.find((tab) => tab.key === activeTab);

  return (
    <div className="flex flex-col gap-4">
      <InventoryTabs view={view} onViewChange={setView} />
      {tabConfig?.implemented ? (
        activeTab === "medicine" ? (
          <MedicineView view={view} />
        ) : activeTab === "forage" ? (
          <ForageView view={view} />
        ) : activeTab === "milk" ? (
          <MilkView />
        ) : null
      ) : (
        <EmptyState title={t("comingSoon.title")} description={t("comingSoon.description")} />
      )}
    </div>
  );
}
