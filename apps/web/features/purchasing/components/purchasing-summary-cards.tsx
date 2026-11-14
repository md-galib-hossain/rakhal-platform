"use client"; // live period-scoped summary query

import { useTranslations } from "next-intl";
import { ShoppingCart, Wallet, AlertCircle, Receipt } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { Card } from "@rakhal/ui/ui/card";
import { MoneyText } from "@/components/shared/money-text";
import type { PeriodRange } from "@/lib/period/presets";
import { usePurchasingSummary } from "../hooks/use-purchasing";

/** RAKHAL-391 (MILESTONE 22) — the AC's "This Month Summary": Total Purchases / Paid Amount /
 * Payable / Purchase Orders, each with a `changePct` delta chip, straight off
 * `GET /purchasing/summary?from&to` (RAKHAL-375). Period-scoped by the screen's shared
 * `DateRangePicker`/`usePeriod()`, same Row B convention `SupplierSummaryCards`'s sibling
 * `finance/overview` panels already established (`delta`/`deltaLabel` on `StatCard`). */
export function PurchasingSummaryCards({ range }: { range: PeriodRange }) {
  const t = useTranslations("purchasing.summary");
  const query = usePurchasingSummary(range);

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} lines={2} className="rounded-xl" />
        ))}
      </div>
    );
  }
  if (query.isError) {
    return (
      <Card className="rounded-2xl p-4">
        <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
      </Card>
    );
  }
  const kpis = query.data?.kpis;
  if (!kpis) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t("totalPurchases")}
        value={<MoneyText amount={kpis.totalPurchases.current} />}
        delta={kpis.totalPurchases.changePct ?? undefined}
        deltaLabel="%"
        icon={<ShoppingCart className="size-4" aria-hidden />}
      />
      <StatCard
        label={t("paidAmount")}
        value={<MoneyText amount={kpis.paidAmount.current} />}
        delta={kpis.paidAmount.changePct ?? undefined}
        deltaLabel="%"
        icon={<Wallet className="size-4" aria-hidden />}
        iconClassName="bg-success-tint text-success"
      />
      <StatCard
        label={t("payable")}
        value={<MoneyText amount={kpis.payable.current} />}
        delta={kpis.payable.changePct ?? undefined}
        deltaLabel="%"
        icon={<AlertCircle className="size-4" aria-hidden />}
        iconClassName="bg-warning-tint text-warning"
      />
      <StatCard
        label={t("purchaseOrders")}
        value={kpis.purchaseOrders.current}
        delta={kpis.purchaseOrders.changePct ?? undefined}
        deltaLabel="%"
        icon={<Receipt className="size-4" aria-hidden />}
      />
    </div>
  );
}
