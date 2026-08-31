"use client"; // period + granularity state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { usePeriod } from "@/lib/hooks/use-period";
import { useSalesSummary } from "../../hooks/use-sales";
import type { SalesTrendGranularity } from "../../types";
import { NewSaleMenu } from "../new-sale-menu";
import { SalesSummaryCards } from "./sales-summary-cards";
import { SalesTrendChart } from "./sales-trend-chart";
import { SalesByProductDonut } from "./sales-by-product-donut";
import { RecentSalesTable } from "./recent-sales-table";
import { TopBuyersList } from "./top-buyers-list";

/** RAKHAL-388 (MILESTONE 22) — Sales → Overview (`BUSINESS_IA_PRD.md` §5.7). Header + `+ New Sale ▾`
 * + `DateRangePicker` + 4 KPIs + Sales Trend (granularity toggle) + Sales by Product donut +
 * Recent Sales table + Top Buyers list. One `useSalesSummary` query backs the KPIs/trend/donut/
 * top-buyers (all four fields the same backend call returns); Recent Sales is its own query since
 * it isn't part of that response shape. */
export function SalesOverviewView() {
  const t = useTranslations("sales.overview");
  const period = usePeriod("this_month");
  const tPreset = useTranslations("period.presets");
  const [granularity, setGranularity] = useState<SalesTrendGranularity>("day");

  const summary = useSalesSummary({ from: period.from, to: period.to }, granularity);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-medium text-foreground">{t("title")}</p>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2">
          <DateRangePicker
            preset={period.preset}
            range={{ from: period.from, to: period.to }}
            label={tPreset(period.preset === "custom" ? "custom" : period.preset)}
            onPresetChange={period.setPreset}
            onRangeChange={period.setRange}
          />
          <NewSaleMenu />
        </div>
      </div>

      <SalesSummaryCards data={summary.data} isLoading={summary.isLoading} isError={summary.isError} onRetry={() => void summary.refetch()} />

      <SalesTrendChart
        data={summary.data}
        isLoading={summary.isLoading}
        isError={summary.isError}
        onRetry={() => void summary.refetch()}
        granularity={granularity}
        onGranularityChange={setGranularity}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <SalesByProductDonut data={summary.data} isLoading={summary.isLoading} isError={summary.isError} onRetry={() => void summary.refetch()} />
        <TopBuyersList data={summary.data} isLoading={summary.isLoading} isError={summary.isError} onRetry={() => void summary.refetch()} />
      </div>

      <RecentSalesTable />
    </div>
  );
}
