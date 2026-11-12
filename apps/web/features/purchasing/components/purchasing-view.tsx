"use client"; // dialog open state + tab state + filter/period state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { Plus, Receipt, ShoppingCart, Truck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { usePeriod } from "@/lib/hooks/use-period";
import { SuppliersView } from "@/features/suppliers/components/suppliers-view";
import { useCanAddSupplier } from "@/features/suppliers/hooks";
import { ExpensesTable } from "./expenses-table";
import { PurchasesTable } from "./purchases-table";
import { PurchasingFiltersBar } from "./purchasing-filters";
import { PurchasingSummaryCards } from "./purchasing-summary-cards";
import { RecordExpenseDialog } from "./record-expense-dialog";
import { RecordPurchaseDialog } from "./record-purchase-dialog";
import type { PayableStatus } from "../types";

const PURCHASING_TABS = ["purchases", "expenses", "suppliers"] as const;
type PurchasingTabKey = (typeof PURCHASING_TABS)[number];

/**
 * RAKHAL-391 (MILESTONE 22) — Purchasing overhaul (`BUSINESS_IA_PRD.md` §5.13). Tabs are
 * **`Purchases | Expenses | Suppliers`**, `?tab=` URL state (Suppliers joined on 2026-10-19 — it was
 * its own sidebar page; `/suppliers` redirects to `/purchasing?tab=suppliers`). Purchases is the
 * default tab. Gained the "This Month Summary" 4-stat panel (`PurchasingSummaryCards`,
 * `GET /purchasing/summary`) and a shared `PurchasingFiltersBar` (payment-status + `DateRangePicker`)
 * driving both ledger tables' server-side filters — both only apply to Purchases/Expenses, so the
 * Suppliers tab (own summary cards, own table) hides them.
 *
 * One primary button per tab: Record Purchase / Record Expense (`purchasing.create`), Add Supplier
 * (`purchasing.create` OR `settings.update` — `POST /settings/suppliers` itself needs the latter).
 * The read views stay gated on `purchasing.read` (`permission-catalogue.ts`).
 */
export function PurchasingView() {
  const t = useTranslations("purchasing");
  const [tab, setTab] = useQueryState(
    "tab",
    parseAsStringEnum<PurchasingTabKey>([...PURCHASING_TABS]).withDefault("purchases"),
  );
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [status, setStatus] = useState<PayableStatus | undefined>(undefined);
  const period = usePeriod("this_month");
  const canAddSupplier = useCanAddSupplier();

  const listFilters = { paymentStatus: status, from: period.from.toISOString(), to: period.to.toISOString() };
  const isLedgerTab = tab !== "suppliers";

  return (
    <div className="flex flex-col gap-4">
      {isLedgerTab ? <PurchasingSummaryCards range={{ from: period.from, to: period.to }} /> : null}

      <Tabs value={tab} onValueChange={(v) => void setTab(v as PurchasingTabKey)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="purchases">
              <ShoppingCart className="mr-1.5 size-4" aria-hidden />
              {t("tabs.purchases")}
            </TabsTrigger>
            <TabsTrigger value="expenses">
              <Receipt className="mr-1.5 size-4" aria-hidden />
              {t("tabs.expenses")}
            </TabsTrigger>
            <TabsTrigger value="suppliers">
              <Truck className="mr-1.5 size-4" aria-hidden />
              {t("tabs.suppliers")}
            </TabsTrigger>
          </TabsList>

          {tab === "purchases" ? (
            <Can I="purchasing.create">
              <Button size="sm" onClick={() => setPurchaseDialogOpen(true)}>
                <Plus className="mr-1.5 size-4" aria-hidden />
                {t("recordPurchaseCta")}
              </Button>
            </Can>
          ) : null}
          {tab === "expenses" ? (
            <Can I="purchasing.create">
              <Button size="sm" onClick={() => setExpenseDialogOpen(true)}>
                <Plus className="mr-1.5 size-4" aria-hidden />
                {t("recordExpenseCta")}
              </Button>
            </Can>
          ) : null}
          {tab === "suppliers" && canAddSupplier ? (
            <Button size="sm" onClick={() => setSupplierDialogOpen(true)}>
              <Plus className="mr-1.5 size-4" aria-hidden />
              {t("addSupplierCta")}
            </Button>
          ) : null}
        </div>

        {isLedgerTab ? (
          <div className="pt-3 pb-3">
            <PurchasingFiltersBar status={status} onStatusChange={setStatus} period={period} />
          </div>
        ) : null}

        <TabsContent value="purchases">
          <Can I="purchasing.read" fallback={<PurchasingPermissionDenied />}>
            <PurchasesTable filters={listFilters} onRecord={() => setPurchaseDialogOpen(true)} />
          </Can>
        </TabsContent>
        <TabsContent value="expenses">
          <Can I="purchasing.read" fallback={<PurchasingPermissionDenied />}>
            <ExpensesTable filters={listFilters} />
          </Can>
        </TabsContent>
        <TabsContent value="suppliers" className="pt-3">
          <Can I="purchasing.read" fallback={<PurchasingPermissionDenied />}>
            <SuppliersView createOpen={supplierDialogOpen} onCreateOpenChange={setSupplierDialogOpen} />
          </Can>
        </TabsContent>
      </Tabs>

      <RecordExpenseDialog open={expenseDialogOpen} onOpenChange={setExpenseDialogOpen} />
      <RecordPurchaseDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen} />
    </div>
  );
}

function PurchasingPermissionDenied() {
  const t = useTranslations("purchasing");
  return <p className="py-8 text-center text-sm text-muted-foreground">{t("permissionDenied")}</p>;
}
