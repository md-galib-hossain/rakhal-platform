"use client"; // active-tab read + legacy ?tab= redirect

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { FinanceTabs, useActiveFinanceTab } from "./finance-tabs";
import { AccountsView } from "./accounts/accounts-view";
import { ReceivablesView } from "./payments/receivables-view";
import { PayablesView } from "./payments/payables-view";
import { OverviewView } from "./overview/overview-view";
import { TransactionsView } from "./transactions/transactions-view";
import { ReportsView } from "./reports/reports-view";

/** RAKHAL-382 — the old 5-tab bar's `?tab=ledger|liabilities|assets` values no longer name a tab
 * (`ledger` folded into `transactions`; `liabilities`/`assets` relocated to their own URL-only
 * routes). `nuqs`'s `parseAsStringEnum` already falls back to the new default (`overview`) for any
 * unrecognized value, so a stale bookmark never 404s — this redirect additionally sends
 * `liabilities`/`assets` bookmarks to where that content actually lives now, and `ledger` straight
 * to its replacement tab, instead of silently landing on Overview. */
function LegacyTabRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawTab = searchParams.get("tab");

  useEffect(() => {
    if (rawTab === "liabilities") router.replace("/finance/liabilities");
    else if (rawTab === "assets") router.replace("/finance/assets");
    else if (rawTab === "ledger") router.replace("/finance?tab=transactions");
  }, [rawTab, router]);

  return null;
}

/** Top-level Finance page body — flattened one tab bar: `Overview | Transactions | Receivables |
 * Payables | Accounts | Reports` (RAKHAL-382, MILESTONE 22, `BUSINESS_IA_PRD.md` §4.3). Each tab
 * owns its own header/KPIs/content (§4.3's per-tab anatomy — `AccountsView`/`ReceivablesView`/
 * `PayablesView` already each build their own internal header) — there is no page-wide KPI/quick
 * action row shared across tabs any more; RAKHAL-383 moved the former "My Highlights"+Quick Actions
 * row (previously mounted here unconditionally above the tab bar, RAKHAL-360/361) into
 * `OverviewView`, Overview-tab-exclusive content. **Receivables/Payables tabs stay mounted on
 * RAKHAL-358's real V2 components**, unchanged. **Accounts** mounts the same `AccountsView`
 * `/finance/accounts` already uses standalone — two entry points, one component. **Transactions**
 * mounts the real `TransactionsView` (RAKHAL-385) — same "one component, two entry points" pattern,
 * also standalone at `/finance/transactions`. **Reports** mounts the real `ReportsView` (RAKHAL-387)
 * — P&L · Cash Flow · Receivable Aging · Payable Aging, Trial Balance deliberately absent per
 * ADR-022/§9.2. **Ledger/Liabilities/Assets are gone from this tab bar** — Ledger's old `LedgerView`/
 * `ledger-*-table.tsx` files are deleted by this same ticket (385), their four business-document
 * segments replaced by one filtered `JournalTransaction`-header feed per ADR-023; Liabilities/Assets
 * live at `/finance/liabilities`/`/finance/assets` (RAKHAL-382). */
export function FinanceView() {
  const activeTab = useActiveFinanceTab();

  return (
    <div className="flex flex-col gap-4">
      <LegacyTabRedirect />

      <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
        <FinanceTabs />
        {activeTab === "overview" ? (
          <OverviewView />
        ) : activeTab === "transactions" ? (
          <TransactionsView />
        ) : activeTab === "receivables" ? (
          <ReceivablesView />
        ) : activeTab === "payables" ? (
          <PayablesView />
        ) : activeTab === "accounts" ? (
          <AccountsView />
        ) : activeTab === "reports" ? (
          <ReportsView />
        ) : null}
      </div>
    </div>
  );
}
