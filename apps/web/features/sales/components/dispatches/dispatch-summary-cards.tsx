"use client"; // live query

import { useTranslations } from "next-intl";
import { CheckCircle2, Truck, Ban, PackageCheck } from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { Card } from "@/components/ui/card";
import { useDispatchesSummary } from "../../hooks/use-sales";

/** RAKHAL-388 — "Dispatch Summary": Total / Delivered / In Transit / Cancelled, each with count
 * and % of total (`BUSINESS_IA_PRD.md` §5.8, `GET /buyers/dispatches/summary`, RAKHAL-378). */
export function DispatchSummaryCards() {
  const t = useTranslations("sales.dispatches.summary");
  const query = useDispatchesSummary();

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
      <StatCard label={t("total")} value={data.total} icon={<PackageCheck className="size-4" aria-hidden />} />
      <StatCard
        label={t("delivered")}
        value={`${data.delivered.count} (${data.delivered.pct}%)`}
        icon={<CheckCircle2 className="size-4" aria-hidden />}
        iconClassName="bg-success-tint text-success"
      />
      <StatCard
        label={t("inTransit")}
        value={`${data.inTransit.count} (${data.inTransit.pct}%)`}
        icon={<Truck className="size-4" aria-hidden />}
        iconClassName="bg-warning-tint text-warning"
      />
      <StatCard
        label={t("cancelled")}
        value={`${data.cancelled.count} (${data.cancelled.pct}%)`}
        icon={<Ban className="size-4" aria-hidden />}
        iconClassName="bg-destructive-tint text-destructive"
      />
    </div>
  );
}
