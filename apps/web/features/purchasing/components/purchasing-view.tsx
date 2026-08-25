"use client"; // dialog open state + tab state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Receipt, ShoppingCart } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { ExpensesTable } from "./expenses-table";
import { PurchasesTable } from "./purchases-table";
import { RecordExpenseDialog } from "./record-expense-dialog";
import { RecordPurchaseDialog } from "./record-purchase-dialog";

/**
 * RAKHAL-359 — Purchasing page: two clearly separate entry points, per `FINANCE_V2_DESIGN.md` §5.1's
 * deliberate Purchase/Expense split ("a feed purchase increases an asset, an electricity bill is an
 * expense"). Not a single form with a type toggle — two distinct dialogs, two distinct tabs, so a
 * farmer never has to guess which mode they're in.
 *
 * Both "Record" buttons and the read views are gated on `purchasing.create`/`purchasing.read`
 * (`permission-catalogue.ts` — confirmed the exact resource/action strings from the backend
 * catalogue directly, not guessed) — a Worker without `purchasing.create` sees the lists but not the
 * buttons; a farm role with neither permission sees nothing at all on this page in practice (the
 * page itself doesn't hard-block on `purchasing.read` since a future role might have `create` but
 * not the default `read`, however unlikely — falling back to each table's own empty/error state is
 * safer than a full-page permission wall for a read-only miss).
 */
export function PurchasingView() {
  const t = useTranslations("purchasing");
  const [expenseDialogOpen, setExpenseDialogOpen] = useState(false);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="expenses">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="expenses">
              <Receipt className="mr-1.5 size-4" aria-hidden />
              {t("tabs.expenses")}
            </TabsTrigger>
            <TabsTrigger value="purchases">
              <ShoppingCart className="mr-1.5 size-4" aria-hidden />
              {t("tabs.purchases")}
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

        <TabsContent value="expenses">
          <Can I="purchasing.read" fallback={<PurchasingPermissionDenied />}>
            <ExpensesTable />
          </Can>
        </TabsContent>
        <TabsContent value="purchases">
          <Can I="purchasing.read" fallback={<PurchasingPermissionDenied />}>
            <PurchasesTable />
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
