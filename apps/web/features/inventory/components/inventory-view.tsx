"use client"; // view-toggle state + active-tab read

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/empty-state";
import { InventoryTabs, useActiveInventoryTab } from "./inventory-tabs";
import { MedicineView } from "./medicine-view";
import { ForageView } from "./forage-view";
import { SemenView } from "./semen-view";
import { MilkView } from "./milk-view";
import { FeedStockView } from "./feed-stock-view";
import { EquipmentView } from "./equipment-view";
import { INVENTORY_TABS } from "../types";

/** Top-level Inventory page body — the category tab bar + grid/list view toggle (Figma
 * "Inventory" frame 732:12409), routing to each tab's view. All tabs have real backed views now
 * (see `types.ts#INVENTORY_TABS` doc comment). Milk and Feed have no grid/list toggle of their own
 * (single fixed layouts, not a table/grid pair like Medicine/Forage) — `view` is simply unused on
 * those branches. */
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
        ) : activeTab === "semen" ? (
          <SemenView />
        ) : activeTab === "milk" ? (
          <MilkView />
        ) : activeTab === "feed" ? (
          <FeedStockView />
        ) : activeTab === "others" ? (
          <EquipmentView view={view} />
        ) : null
      ) : (
        <EmptyState title={t("comingSoon.title")} description={t("comingSoon.description")} />
      )}
    </div>
  );
}
