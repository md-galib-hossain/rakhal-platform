"use client"; // dialog open state + tab state + filter/period state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Receipt, ShoppingCart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { usePeriod } from "@/lib/hooks/use-period";
import { ExpensesTable } from "./expenses-table";
import { PurchasesTable } from "./purchases-table";
import { PurchasingFiltersBar } from "./purchasing-filters";
import { PurchasingSummaryCards } from "./purchasing-summary-cards";
import { RecordExpenseDialog } from "./record-expense-dialog";
import { RecordPurchaseDialog } from "./record-purchase-dialog";
import type { PayableStatus } from "../types";

/**
 * RAKHAL-391 (MILESTONE 22) — Purchasing overhaul (`BUSINESS_IA_PRD.md` §5.13). Tabs reordered to
 * **`Purchases | Expenses`** (was `Expenses | Purchases`, RAKHAL-359's original order) — mockup 1's
 * `Purchases | Suppliers` is superseded (Suppliers is its own top-level module since RAKHAL-390), the
 * AC resolves as `Purchases | Expenses` with Purchases first and as the default tab. Gained the "This
 * Month Summary" 4-stat panel (`PurchasingSummaryCards`, `GET /purchasing/summary`) and a shared
 * `PurchasingFiltersBar` (payment-status + `DateRangePicker`) driving both tables' server-side
 * filters — replacing RAKHAL-359's un-paginated, unfiltered `usePurchases()`/`useExpenses()`.
 *
 * Both "Record" buttons and the read views stay gated on `purchasing.create`/`purchasing.read`
 * (`permission-catalogue.ts`, confirmed directly) — unchanged from RAKHAL-359.
 */
export function PurchasingView() {
  const t = useTranslations("purchasing");
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [status, setStatus] = useState<PayableStatus | undefined>(undefined);
  const period = usePeriod("this_month");

  const listFilters = { status, from: period.from.toISOString(), to: period.to.toISOString() };

  return (
    <div className="flex flex-col gap-4">
      <PurchasingSummaryCards range={{ from: period.from, to: period.to }} />

      <Tabs defaultValue="purchases">
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
          </TabsList>
          <Can I="purchasing.create">
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setExpenseDialogOpen(true)}>
                <Plus className="mr-1.5 size-4" aria-hidden />
                {t("recordExpenseCta")}
              </Button>
              <Button size="sm" onClick={() => setPurchaseDialogOpen(true)}>
                <Plus className="mr-1.5 size-4" aria-hidden />
                {t("recordPurchaseCta")}
              </Button>
            </div>
          </Can>
        </div>

        <div className="pt-3 pb-3">
          <PurchasingFiltersBar status={status} onStatusChange={setStatus} period={period} />
        </div>

        <TabsContent value="purchases">
          <Can I="purchasing.read" fallback={<PurchasingPermissionDenied />}>
            <PurchasesTable filters={listFilters} />
          </Can>
        </TabsContent>
        <TabsContent value="expenses">
          <Can I="purchasing.read" fallback={<PurchasingPermissionDenied />}>
            <ExpensesTable filters={listFilters} />
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
