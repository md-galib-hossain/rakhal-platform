"use client"; // tab URL state

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { LayoutDashboard, Receipt, Truck } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesOverviewView } from "./overview/sales-overview-view";
import { InvoicesView } from "./invoices/invoices-view";
import { DispatchesView } from "./dispatches/dispatches-view";

const SALES_TABS = ["overview", "invoices", "dispatches"] as const;
type SalesTabKey = (typeof SALES_TABS)[number];

/** RAKHAL-388 (MILESTONE 22) — Sales module top-level screen (`BUSINESS_IA_PRD.md` §5.7-§5.9):
 * `Overview | Invoices | Dispatches` tab bar, `?tab=` URL state (same `useQueryState` convention
 * `FinanceTabs`/`PurchasingView` establish). Mounted at `/sales`, replacing the RAKHAL-357-era
 * scaffold that only hosted the wizard trigger. */
export function SalesView() {
  const t = useTranslations("sales.tabs");
  const [tab, setTab] = useQueryState("tab", parseAsStringEnum<SalesTabKey>([...SALES_TABS]).withDefault("overview"));

  return (
    <Tabs value={tab} onValueChange={(v) => void setTab(v as SalesTabKey)}>
      <TabsList>
        <TabsTrigger value="overview">
          <LayoutDashboard className="mr-1.5 size-4" aria-hidden />
          {t("overview")}
        </TabsTrigger>
        <TabsTrigger value="invoices">
          <Receipt className="mr-1.5 size-4" aria-hidden />
          {t("invoices")}
        </TabsTrigger>
        <TabsTrigger value="dispatches">
          <Truck className="mr-1.5 size-4" aria-hidden />
          {t("dispatches")}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <SalesOverviewView />
      </TabsContent>
      <TabsContent value="invoices">
        <InvoicesView />
      </TabsContent>
      <TabsContent value="dispatches">
        <DispatchesView />
      </TabsContent>
    </Tabs>
  );
}
