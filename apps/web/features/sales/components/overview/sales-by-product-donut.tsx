"use client"; // live query + dynamic chart import

import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { ChartCard } from "@/components/shared/chart-card";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import type { SaleLineType, SalesSummary } from "../../types";
import type { DonutSlice } from "@/features/dashboard/components/herd-status-chart-inner";

const LINE_TYPE_COLOR: Record<SaleLineType, string> = {
  MILK: "var(--info)",
  ANIMAL: "var(--accent-indigo)",
  INVENTORY: "var(--success)",
  MANURE: "var(--warning)",
};

const HerdStatusChartInner = dynamic(() => import("@/features/dashboard/components/herd-status-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="mx-auto size-[170px] rounded-full" />,
});

/** RAKHAL-388 — "Sales by Product" donut (`BUSINESS_IA_PRD.md` §5.7: "Milk / Calves / Other
 * Products with % share, grouped by SaleLine.type"). Reuses the dashboard's generic donut renderer
 * (`herd-status-chart-inner.tsx#DonutSlice`) as-is rather than duplicating a second pie-chart
 * component for the same visual shape — its own props are already type-agnostic (`name`/`value`/
 * `color`). Its `centerValue` prop only renders a bare number (no currency formatting) — the total
 * is shown formatted as money in the caption line below instead, `centerValue` gets the rounded
 * figure as a secondary, non-currency-formatted cue. `ANIMAL` renders as the mockup's literal
 * "Calves" label per the AC. */
export function SalesByProductDonut({
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
  const t = useTranslations("sales.overview.byProduct");
  const locale = useLocale() as Locale;

  if (isLoading) return <Skeleton className="h-[320px] w-full rounded-2xl" />;
  if (isError) {
    return (
      <ChartCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={onRetry} />
      </ChartCard>
    );
  }

  const byProduct = data?.byProduct ?? [];
  const total = byProduct.reduce((sum, p) => sum + Number(p.amount), 0);
  const slices: DonutSlice[] = byProduct.map((p) => ({
    name: t(`lineType.${p.lineType}`),
    value: Number(p.amount),
    color: LINE_TYPE_COLOR[p.lineType],
  }));

  return (
    <ChartCard title={t("title")}>
      {slices.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-between gap-6">
          <HerdStatusChartInner slices={slices} centerLabel={t("totalLabel")} centerValue={Math.round(total)} />
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {byProduct.map((p) => (
              <span key={p.lineType} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden className="h-1.5 w-3 rounded-full" style={{ backgroundColor: LINE_TYPE_COLOR[p.lineType] }} />
                {t(`lineType.${p.lineType}`)}: <span className="font-medium text-foreground">{p.sharePct}%</span>
              </span>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">{formatMoney(total, locale)}</p>
        </div>
      )}
    </ChartCard>
  );
}
