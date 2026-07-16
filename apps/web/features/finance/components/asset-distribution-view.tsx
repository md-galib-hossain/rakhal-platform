"use client"; // live query + dynamic chart imports

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { Skeleton } from "@/components/ui/skeleton";
import { useAssets } from "../hooks/use-finance";

const AssetAllocationChartInner = dynamic(() => import("./asset-allocation-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto size-[220px] rounded-full" />,
});
const AssetDepreciationChartInner = dynamic(() => import("./asset-depreciation-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[340px] w-full" />,
});

/** "Asset Distribution" tab — Figma node `1039:33988`: "Asset Allocation" donut + legend + Total Net
 * Worth (left), "Fixed Asset Depreciation" grouped bar chart (right). Both sourced from the one
 * `GET /finance/assets` response (`finance.service.ts#assets`). */
export function AssetDistributionView() {
  const t = useTranslations("finance.assets");
  const query = useAssets();

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CardSkeleton lines={8} className="rounded-2xl" />
        <CardSkeleton lines={8} className="rounded-2xl" />
      </div>
    );
  }
  if (query.isError) {
    return (
      <div className="rounded-2xl border border-border p-4">
        <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
      </div>
    );
  }
  const data = query.data;
  if (!data) return null;

  const depreciationLabels = { bookValue: t("depreciation.bookValue"), accumulatedDepreciation: t("depreciation.accumulatedDepreciation") };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-6 rounded-2xl border border-border p-4">
        <p className="text-xl font-medium text-foreground">{t("allocation.title")}</p>
        <AssetAllocationChartInner slices={data.allocation} />
        <div className="flex flex-col gap-4">
          {data.allocation.map((slice) => (
            <div key={slice.category} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span aria-hidden className="h-1.5 w-3 shrink-0 rounded-full" style={{ backgroundColor: slice.color }} />
                <p className="text-sm text-muted-foreground">{t(`allocation.categories.${slice.category}`)}</p>
              </div>
              <p className="text-sm text-foreground">
                <MoneyText amount={slice.value} />
              </p>
            </div>
          ))}
          <div className="flex items-center justify-between border-t border-border pt-4 text-base font-bold">
            <p className="text-foreground">{t("allocation.totalNetWorth")}</p>
            <p className="text-primary">
              <MoneyText amount={data.totalNetWorth} />
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-6 rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xl font-medium text-foreground">{t("depreciation.title")}</p>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className="h-1.5 w-3 rounded-full bg-[#007fff]" />
              {t("depreciation.bookValue")}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span aria-hidden className="h-1.5 w-3 rounded-full bg-[#f59e0b]" />
              {t("depreciation.accumulatedDepreciation")}
            </div>
          </div>
        </div>
        {data.depreciation.length > 0 ? (
          <AssetDepreciationChartInner rows={data.depreciation} labels={depreciationLabels} />
        ) : (
          <p className="py-16 text-center text-sm text-muted-foreground">{t("depreciation.empty")}</p>
        )}
      </div>
    </div>
  );
}
