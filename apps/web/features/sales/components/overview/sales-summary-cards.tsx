"use client"; // live period-scoped summary query

import { useTranslations } from "next-intl";
import { AlertCircle, Receipt, ShoppingCart, Wallet } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CardSkeleton } from "@rakhal/ui/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { Card } from "@rakhal/ui/ui/card";
import { MoneyText } from "@/components/shared/money-text";
import type { SalesSummary } from "../../types";

/** RAKHAL-388 (MILESTONE 22) — Sales Overview's 4 KPIs: Total Sales / Total Invoices / Paid
 * Amount / Outstanding, each with a `changePct` delta chip (`BUSINESS_IA_PRD.md` §5.7), same
 * `StatCard` `delta` convention `PurchasingSummaryCards` established. */
export function SalesSummaryCards({
  data,
  isLoading,
  isError,
  onRetry,
}: {
  data: SalesSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const t = useTranslations("sales.overview.summary");

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} lines={2} className="rounded-xl" />
        ))}
      </div>
    );
  }
  if (isError) {
    return (
      <Card className="rounded-2xl p-4">
        <ErrorState description={t("error")} onRetry={onRetry} />
      </Card>
    );
  }
  const kpis = data?.kpis;
  if (!kpis) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard
        label={t("totalSales")}
        value={<MoneyText amount={kpis.totalSales.current} />}
        delta={kpis.totalSales.changePct ?? undefined}
        deltaLabel="%"
        icon={<ShoppingCart className="size-4" aria-hidden />}
      />
      <StatCard
        label={t("totalInvoices")}
        value={kpis.totalInvoices.current}
        delta={kpis.totalInvoices.changePct ?? undefined}
        deltaLabel="%"
        icon={<Receipt className="size-4" aria-hidden />}
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
        label={t("outstanding")}
        value={<MoneyText amount={kpis.outstanding.current} />}
        delta={kpis.outstanding.changePct ?? undefined}
        deltaLabel="%"
        icon={<AlertCircle className="size-4" aria-hidden />}
        iconClassName="bg-warning-tint text-warning"
      />
    </div>
  );
}
