"use client"; // active-tab read + quick-action dialog state

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Gift, Receipt, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { RecordSaleTrigger } from "@/features/sales/components/record-sale-trigger";
import { TransferFormSheet } from "./accounts/transfer-form-sheet";
import { FinanceHighlights } from "./finance-highlights";
import { FinanceTabs, useActiveFinanceTab } from "./finance-tabs";
import { LedgerView } from "./ledger-view";
import { ReceivablesView } from "./payments/receivables-view";
import { PayablesView } from "./payments/payables-view";
import { LiabilitiesView } from "./liabilities-view";
import { AssetDistributionView } from "./asset-distribution-view";
import { FINANCE_TABS, type FinanceTabKey } from "../types";

const TAB_KEYS = FINANCE_TABS.map((t) => t.key) as [FinanceTabKey, ...FinanceTabKey[]];

/**
 * RAKHAL-361 — Finance-home quick-action row, wired to real destinations (was RAKHAL-360's
 * all-disabled "Coming soon" placeholder row — every one of 356/357/358/359 is `DONE` now).
 *
 * - **Record Sale** / **Other Income** — both reuse RAKHAL-357's `RecordSaleTrigger` +
 *   `RecordSaleDialog` directly (no re-implementation) via its own `initial` prop (RAKHAL-361's own
 *   addition to that component) to pre-select "Other Income" for the second button. Both are real,
 *   gated `finance.create` inside `RecordSaleTrigger` itself.
 * - **Record Expense** — links to `/purchasing` (RAKHAL-359's own route), which hosts *both* Record
 *   Expense and Record Purchase — no separate "Record Purchase" quick action exists in
 *   `FINANCE_V2_DESIGN.md`'s top-level action list ("Record Sale · Record Expense · Other Income ·
 *   Receive Payment · Make Payment · Transfer Money"), so Purchase is reached only via Purchasing's
 *   own entry point, per this ticket's own brief.
 * - **Receive Payment** / **Make Payment** — switch the tab bar below to the real
 *   Receivables/Payables tab (RAKHAL-358's `ReceivablesView`/`PayablesView`, now mounted there —
 *   see this file's tab wiring) rather than opening a bare picker-then-dialog with no list context;
 *   the farmer picks *which* receivable/payable to settle from the list, same as every other
 *   settle-a-specific-document flow in this codebase (RAKHAL-358's own `ReceivablesTable`/
 *   `PayablesTable` row actions do the real "Receive Payment"/"Make Payment" work). Documented
 *   judgment call, not a guess: a bare quick-action dialog with no target document to settle would
 *   need its own picker step anyway, so routing straight to the real list is strictly less friction.
 * - **Transfer Money** — mounts RAKHAL-356's `TransferFormSheet` directly, gated `<Can
 *   I="finance.transfer">` (owner-only per RAKHAL-353) with the exact same disabled+tooltip fallback
 *   `accounts-view.tsx`'s own Transfer button already uses, so a non-owner never sees an
 *   enabled-but-403 control here either.
 */
function QuickActions() {
  const t = useTranslations("finance.ledgerV2.actions");
  const tAccounts = useTranslations("finance.accountsPage");
  const [, setTab] = useQueryState("tab", parseAsStringEnum<FinanceTabKey>(TAB_KEYS).withDefault("ledger"));
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-4 shadow-card">
      <RecordSaleTrigger label={t("recordSale")} icon={ShoppingCart} buttonProps={{ variant: "outline", size: "sm", className: "gap-1.5" }} />

      <Button asChild variant="outline" size="sm" className="gap-1.5">
        <Link href="/purchasing">
          <Receipt className="size-4" aria-hidden />
          {t("recordExpense")}
        </Link>
      </Button>

      <RecordSaleTrigger
        initial={{ type: "OTHER_INCOME" }}
        label={t("otherIncome")}
        icon={Gift}
        buttonProps={{ variant: "outline", size: "sm", className: "gap-1.5" }}
      />

      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void setTab("receivables")}>
        <ArrowDownToLine className="size-4" aria-hidden />
        {t("receivePayment")}
      </Button>

      <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void setTab("payables")}>
        <ArrowUpFromLine className="size-4" aria-hidden />
        {t("makePayment")}
      </Button>

      <Can
        I="finance.transfer"
        fallback={
          <Button variant="outline" size="sm" className="gap-1.5" disabled title={tAccounts("transferOwnerOnlyTooltip")}>
            <ArrowLeftRight className="size-4" aria-hidden />
            {t("transferMoney")}
          </Button>
        }
      >
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTransferOpen(true)}>
          <ArrowLeftRight className="size-4" aria-hidden />
          {t("transferMoney")}
        </Button>
      </Can>
      <TransferFormSheet open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}

/** Top-level Finance page body — Figma "Finance" frame (file `SCfMPdxP6vgW1uTxfqCtz7`): "My
 * Highlights" KPI row (Finance V2's Rakhal Balance summary, RAKHAL-360) + the Quick Actions row
 * (RAKHAL-360's layout, RAKHAL-361's real wiring) + the 5-tab bar. **Receivables/Payables tabs now
 * mount RAKHAL-358's real V2 components** (`./payments/{receivables-view,payables-view}`) — V1's
 * `settlements-view.tsx` (and its `settlements-table.tsx`/`settlements-columns.tsx`/
 * `record-payment-dialog.tsx`) is deleted by this ticket, not just unmounted, since nothing else
 * referenced it (grepped first). Liabilities/Assets stay V1 (`liabilities-view.tsx`/
 * `asset-distribution-view.tsx`) untouched — `FinanceLoan`/`FixedAsset` explicitly survive V2
 * unchanged per `FINANCE_V2_DESIGN.md` §5.2, out of this milestone's scope. */
export function FinanceView() {
  const activeTab = useActiveFinanceTab();

  return (
    <div className="flex flex-col gap-4">
      <FinanceHighlights />
      <QuickActions />

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
