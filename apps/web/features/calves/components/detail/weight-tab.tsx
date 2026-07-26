"use client"; // local dialog-open state + dynamic chart import

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { RecordWeightDialog } from "../dialogs/record-weight-dialog";
import type { CalfDetail } from "../../types";

// Dynamic-imported (kept off initial /calves route JS) — same pattern as Cattle's OverviewTab.
const TrendChartInner = dynamic(() => import("@/features/cattle/components/detail/charts/trend-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

export function WeightTab({ calfId, data }: { calfId: string; data: CalfDetail }) {
  const t = useTranslations("calves.detail.weight");
  const [open, setOpen] = useState(false);

  const chartData = data.weightRecords.map((r) => ({ date: r.date, weight: r.weightKg }));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Can I="calf.log-feeding">
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <Plus className="size-4" aria-hidden />
            {t("recordWeight")}
          </Button>
        </Can>
      </div>
      {chartData.length === 0 ? (
        <EmptyState title={t("empty")} className="py-10" />
      ) : (
        <TrendChartInner
          data={chartData}
          xKey="date"
          series={[{ key: "weight", label: t("weightKg"), color: "var(--success)" }]}
        />
      )}
      <RecordWeightDialog calfId={calfId} open={open} onOpenChange={setOpen} />
    </div>
  );
}
