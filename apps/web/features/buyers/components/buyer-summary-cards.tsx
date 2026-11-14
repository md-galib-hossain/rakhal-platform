"use client"; // live query

import { useTranslations } from "next-intl";
import { AlertCircle, Users, UserCheck, Wallet } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { Card } from "@rakhal/ui/ui/card";
import { MoneyText } from "@/components/shared/money-text";
import { useBuyersSummary } from "../hooks/use-buyers";

/** RAKHAL-389 — the AC's 4-stat Buyer Summary: Total Buyers / Active Buyers / Total Sales / Total
 * Outstanding, off `GET /buyers/summary` (RAKHAL-372). Same `StatCard` shape `SupplierSummaryCards`
 * already established for the analogous Purchasing-side module. */
export function BuyerSummaryCards() {
  const t = useTranslations("buyers.summary");
  const query = useBuyersSummary();

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
  const data = query.data;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label={t("totalBuyers")} value={data.totalBuyers} icon={<Users className="size-4" aria-hidden />} />
      <StatCard
        label={t("activeBuyers")}
        value={data.activeBuyers}
        icon={<UserCheck className="size-4" aria-hidden />}
        iconClassName="bg-success-tint text-success"
      />
      <StatCard
        label={t("totalSales")}
        value={<MoneyText amount={Number(data.totalSales)} />}
        icon={<Wallet className="size-4" aria-hidden />}
      />
      <StatCard
        label={t("totalOutstanding")}
        value={<MoneyText amount={Number(data.totalOutstanding)} />}
        icon={<AlertCircle className="size-4" aria-hidden />}
        iconClassName="bg-warning-tint text-warning"
      />
    </div>
  );
}
