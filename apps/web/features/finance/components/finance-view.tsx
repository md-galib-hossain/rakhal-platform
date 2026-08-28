"use client"; // active-tab read + quick-action dialog state + legacy ?tab= redirect

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Gift, Receipt, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { EmptyState } from "@/components/shared/empty-state";
import { RecordSaleTrigger } from "@/features/sales/components/record-sale-trigger";
import { TransferFormSheet } from "./accounts/transfer-form-sheet";
import { FinanceHighlights } from "./finance-highlights";
import { FinanceTabs, useActiveFinanceTab } from "./finance-tabs";
import { AccountsView } from "./accounts/accounts-view";
import { ReceivablesView } from "./payments/receivables-view";
import { PayablesView } from "./payments/payables-view";
import { FINANCE_TABS, type FinanceTabKey } from "../types";

const TAB_KEYS = FINANCE_TABS.map((t) => t.key) as [FinanceTabKey, ...FinanceTabKey[]];

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
  const [, setTab] = useQueryState("tab", parseAsStringEnum<FinanceTabKey>(TAB_KEYS).withDefault("overview"));
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

/** Top-level Finance page body — RAKHAL-382 (MILESTONE 22, `BUSINESS_IA_PRD.md` §4.3) flattened
 * this to one tab bar: `Overview | Transactions | Receivables | Payables | Accounts | Reports`.
 * "My Highlights" KPI row (Finance V2's Rakhal Balance summary, RAKHAL-360) + the Quick Actions row
 * (RAKHAL-360's layout, RAKHAL-361's real wiring) sit above the tab bar, unchanged by this ticket —
 * both are RAKHAL-383's lane to rework into the Overview screen's Row A/quick-actions redesign.
 * **Receivables/Payables tabs stay mounted on RAKHAL-358's real V2 components**
 * (`./payments/{receivables-view,payables-view}`), unchanged. **Accounts** now mounts the same
 * `AccountsView` `/finance/accounts` already used standalone — that route keeps working too, this
 * is a second entry point onto the identical component, not a fork. **Overview/Transactions/
 * Reports** are placeholder shells pending their own Phase-E tickets (383/385/387) — same
 * `EmptyState` "coming soon" precedent RAKHAL-381 already established for the relocated Liabilities/
 * Assets routes. **Ledger/Liabilities/Assets are gone from this tab bar** — Ledger's old
 * `LedgerView`/`ledger-*-table.tsx` files are left in place, unmounted, cleanup deferred to
 * RAKHAL-385 (which replaces them with the real Transactions screen); Liabilities/Assets moved to
 * `/finance/liabilities`/`/finance/assets` (this same ticket, see those pages' own doc comments). */
export function FinanceView() {
  const activeTab = useActiveFinanceTab();
  const t = useTranslations("common");

  return (
    <div className="flex flex-col gap-4">
      <LegacyTabRedirect />
      <FinanceHighlights />
      <QuickActions />

      <div className="flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card">
        <FinanceTabs />
        {activeTab === "overview" ? (
          <EmptyState title={t("comingSoonTitle")} description={t("comingSoonDescription")} />
        ) : activeTab === "transactions" ? (
          <EmptyState title={t("comingSoonTitle")} description={t("comingSoonDescription")} />
        ) : activeTab === "receivables" ? (
          <ReceivablesView />
        ) : activeTab === "payables" ? (
          <PayablesView />
        ) : activeTab === "accounts" ? (
          <AccountsView />
        ) : activeTab === "reports" ? (
          <EmptyState title={t("comingSoonTitle")} description={t("comingSoonDescription")} />
        ) : null}
      </div>
    </div>
  );
}
