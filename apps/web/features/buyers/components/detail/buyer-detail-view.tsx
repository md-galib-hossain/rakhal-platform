"use client"; // tab URL state + live buyer fetch

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { LayoutDashboard, Receipt, Truck, Wallet, ScrollText } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { useBuyer } from "../../hooks/use-buyers";
import { BUYER_DETAIL_TABS, type BuyerDetailTabKey } from "../../types";
import { BuyerDetailHeader } from "./buyer-detail-header";
import { BuyerOverviewTab } from "./buyer-overview-tab";
import { BuyerSalesTab } from "./buyer-sales-tab";
import { BuyerDispatchesTab } from "./buyer-dispatches-tab";
import { BuyerPaymentsTab } from "./buyer-payments-tab";
import { BuyerBalanceTab } from "./buyer-balance-tab";

const TAB_ICONS: Record<BuyerDetailTabKey, typeof LayoutDashboard> = {
  overview: LayoutDashboard,
  sales: Receipt,
  dispatches: Truck,
  payments: Wallet,
  balance: ScrollText,
};

/** RAKHAL-389 (MILESTONE 22) — buyer detail page (`BUSINESS_IA_PRD.md` §5.11): header (back link +
 * name + Edit + 3 stats) + tabs `Overview | Sales & Invoices | Dispatches | Payments | Balance`,
 * `?tab=` URL state (same convention every other tabbed screen in this milestone uses). */
export function BuyerDetailView({ buyerId }: { buyerId: string }) {
  const t = useTranslations("buyers.detail.tabs");
  const [tab, setTab] = useQueryState("tab", parseAsStringEnum<BuyerDetailTabKey>([...BUYER_DETAIL_TABS]).withDefault("overview"));
  const query = useBuyer(buyerId);

  if (query.isLoading) return <CardSkeleton lines={8} className="rounded-2xl" />;
  if (query.isError || !query.data) {
    return <ErrorState onRetry={() => void query.refetch()} />;
  }

  return (
    <div className="flex flex-col gap-4">
      <BuyerDetailHeader buyer={query.data} />

      <Tabs value={tab} onValueChange={(v) => void setTab(v as BuyerDetailTabKey)}>
        <TabsList>
          {BUYER_DETAIL_TABS.map((key) => {
            const Icon = TAB_ICONS[key];
            return (
              <TabsTrigger key={key} value={key}>
                <Icon className="mr-1.5 size-4" aria-hidden />
                {t(key)}
              </TabsTrigger>
            );
          })}
        </TabsList>

        <TabsContent value="overview">
          <BuyerOverviewTab buyerId={buyerId} />
        </TabsContent>
        <TabsContent value="sales">
          <BuyerSalesTab buyerId={buyerId} />
        </TabsContent>
        <TabsContent value="dispatches">
          <BuyerDispatchesTab buyerId={buyerId} />
        </TabsContent>
        <TabsContent value="payments">
          <BuyerPaymentsTab buyerId={buyerId} />
        </TabsContent>
        <TabsContent value="balance">
          <BuyerBalanceTab buyerId={buyerId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
