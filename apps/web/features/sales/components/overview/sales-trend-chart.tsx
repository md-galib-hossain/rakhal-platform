"use client"; // dynamic chart import + granularity state

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { ChartCard } from "@/components/shared/chart-card";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { Locale } from "@/lib/constants/i18n";
import type { SalesSummary, SalesTrendGranularity } from "../../types";

const GRANULARITIES: SalesTrendGranularity[] = ["day", "week", "month"];

const SalesTrendChartInner = dynamic(() => import("./sales-trend-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[260px] w-full" />,
});

/** RAKHAL-388 — "Sales Trend" card with the AC's `By Day ▾` granularity toggle
 * (`BUSINESS_IA_PRD.md` §5.7). Data comes from the same `useSalesSummary` query the KPI cards use
 * (`trend` field, `granularity`-keyed) — switching the toggle refetches via the parent's own state. */
export function SalesTrendChart({
  data,
  isLoading,
  isError,
  onRetry,
  granularity,
  onGranularityChange,
}: {
  data: SalesSummary | undefined;
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  granularity: SalesTrendGranularity;
  onGranularityChange: (g: SalesTrendGranularity) => void;
}) {
  const t = useTranslations("sales.overview.trend");
  const locale = useLocale() as Locale;

  const rangeControl = (
    <Select value={granularity} onValueChange={(v) => onGranularityChange(v as SalesTrendGranularity)}>
      <SelectTrigger className="w-[120px]" aria-label={t("granularityLabel")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {GRANULARITIES.map((g) => (
          <SelectItem key={g} value={g}>
            {t(`granularityOptions.${g}`)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );

  if (isLoading) return <Skeleton className="h-[320px] w-full rounded-2xl" />;
  if (isError) {
    return (
      <ChartCard title={t("title")} rangeControl={rangeControl}>
        <ErrorState description={t("error")} onRetry={onRetry} />
      </ChartCard>
    );
  }

  return (
    <ChartCard title={t("title")} rangeControl={rangeControl}>
      <SalesTrendChartInner trend={data?.trend ?? []} label={t("legend")} locale={locale} />
    </ChartCard>
  );
}
