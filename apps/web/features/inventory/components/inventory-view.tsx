"use client"; // view-toggle state + active-tab read

import { useState } from "react";
import { useTranslations } from "next-intl";
import { EmptyState } from "@/components/shared/empty-state";
import { InventoryTabs, useActiveInventoryTab } from "./inventory-tabs";
import { MedicineView } from "./medicine-view";
import { ForageView } from "./forage-view";
import { INVENTORY_TABS } from "../types";

/** Top-level Inventory page body — the 5-category tab bar + grid/list view toggle (Figma
 * "Inventory" frame 732:12409), routing to each tab's view. Medicine and Forage have real backed
 * views so far (see `types.ts#INVENTORY_TABS` doc comment) — the remaining 3 tabs switch and render
 * an honest "not built yet" empty state instead of fabricated data. */
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
        ) : null
      ) : (
        <EmptyState title={t("comingSoon.title")} description={t("comingSoon.description")} />
      )}
    </div>
  );
}
