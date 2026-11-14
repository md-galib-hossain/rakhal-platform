"use client"; // live summary query

import { useTranslations } from "next-intl";
import { Truck, UserCheck, Wallet, AlertCircle } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CardSkeleton } from "@rakhal/ui/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { Card } from "@rakhal/ui/ui/card";
import { MoneyText } from "@/components/shared/money-text";
import { useSuppliersSummaryV2 } from "../hooks";

/** RAKHAL-390 — the AC's "4-stat Supplier Summary": Total Suppliers, Active Suppliers, Total
 * Purchases, Total Payable — straight off `GET /purchasing/suppliers/summary` (RAKHAL-373). */
export function SupplierSummaryCards() {
  const t = useTranslations("suppliers.summary");
  const query = useSuppliersSummaryV2();

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
      <StatCard label={t("totalSuppliers")} value={data.totalCount} icon={<Truck className="size-4" aria-hidden />} />
      <StatCard
        label={t("activeSuppliers")}
        value={data.activeCount}
        icon={<UserCheck className="size-4" aria-hidden />}
        iconClassName="bg-success-tint text-success"
      />
      <StatCard
        label={t("totalPurchases")}
        value={<MoneyText amount={Number(data.totalPurchases)} />}
        icon={<Wallet className="size-4" aria-hidden />}
      />
      <StatCard
        label={t("totalPayable")}
        value={<MoneyText amount={Number(data.totalPayable)} />}
        icon={<AlertCircle className="size-4" aria-hidden />}
        iconClassName="bg-warning-tint text-warning"
      />
    </div>
  );
}
