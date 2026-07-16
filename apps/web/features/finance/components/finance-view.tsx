"use client"; // active-tab read

import { FinanceHighlights } from "./finance-highlights";
import { FinanceTabs, useActiveFinanceTab } from "./finance-tabs";
import { LedgerView } from "./ledger-view";
import { PayablesView, ReceivablesView } from "./settlements-view";
import { LiabilitiesView } from "./liabilities-view";
import { AssetDistributionView } from "./asset-distribution-view";

/** Top-level Finance page body — Figma "Finance" frame (file `SCfMPdxP6vgW1uTxfqCtz7`): "My
 * Highlights" KPI row (shared by every tab) + the 5-tab bar, routing to each tab's view. */
export function FinanceView() {
  const activeTab = useActiveFinanceTab();

  return (
    <div className="flex flex-col gap-4">
      <FinanceHighlights />

      <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
        <FinanceTabs />
        {activeTab === "ledger" ? (
          <LedgerView />
        ) : activeTab === "receivables" ? (
          <ReceivablesView />
        ) : activeTab === "payables" ? (
          <PayablesView />
        ) : activeTab === "liabilities" ? (
          <LiabilitiesView />
        ) : activeTab === "assets" ? (
          <AssetDistributionView />
        ) : null}
      </div>
    </div>
  );
}
