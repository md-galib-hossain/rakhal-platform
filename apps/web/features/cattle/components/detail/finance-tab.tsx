"use client"; // live query + dynamic chart import + month state

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/shared/stat-card";
import { ChartCard } from "@/components/shared/chart-card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useCattleFinance } from "../../hooks/use-cattle-detail-tabs";

const TrendChartInner = dynamic(() => import("./charts/trend-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

function currentPeriod(offset: number): string {
  const d = new Date();
  d.setUTCMonth(d.getUTCMonth() + offset);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Finance tab (Figma B1-S9) — per-animal P&L via `GET /cattle/:id/finance?period=`. Expense/income
 * breakdowns render as a simple labeled-row list with a percentage bar rather than the mock's custom
 * `SegmentedBreakdownBar` (one shared proportional bar) — same data, simpler component, no new
 * shared molecule for a single consumer. Month navigation is prev/next only (no calendar picker),
 * matching the mock's intent without a new date-picker component. */
export function FinanceTab({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.finance");
  const [offset, setOffset] = useState(0);
  const period = currentPeriod(offset);
  const query = useCattleFinance(cattleId, period);

  if (query.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }
  if (query.isError) {
    return <ErrorState description={t("error")} onRetry={() => query.refetch()} />;
  }
  const data = query.data;
  if (!data) return null;

  const expenseEntries = Object.entries(data.expense_breakdown) as [keyof typeof data.expense_breakdown, number][];
  const incomeEntries = Object.entries(data.income_breakdown) as [keyof typeof data.income_breakdown, number][];
  const expenseTotal = expenseEntries.reduce((sum, [, v]) => sum + v, 0);
  const incomeTotal = incomeEntries.reduce((sum, [, v]) => sum + v, 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label={t("totalIncome")} value={<MoneyText amount={data.total_income} />} />
        <StatCard label={t("totalCost")} value={<MoneyText amount={data.total_cost} />} />
        <StatCard label={t("netProfit")} value={<MoneyText amount={data.net_profit} colorize />} />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">{data.period}</p>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setOffset((o) => o - 1)} aria-label={t("previousMonth")}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setOffset((o) => Math.min(o + 1, 0))}
            disabled={offset >= 0}
            aria-label={t("nextMonth")}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <BreakdownCard title={t("expenseBreakdown")} entries={expenseEntries} total={expenseTotal} labelKey="expenseLabels" />
        <BreakdownCard title={t("incomeBreakdown")} entries={incomeEntries} total={incomeTotal} labelKey="incomeLabels" />
      </div>

      <ChartCard
        title={t("monthlyChart")}
        legend={
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-3 rounded-full bg-success" />
              <p className="text-xs font-medium text-muted-foreground">{t("income")}</p>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-3 rounded-full bg-destructive" />
              <p className="text-xs font-medium text-muted-foreground">{t("cost")}</p>
            </div>
          </div>
        }
      >
        <TrendChartInner
          data={data.monthly_chart}
          xKey="month"
          valueFormatter={(v) => `৳${v.toLocaleString()}`}
          series={[
            { key: "income", label: t("income"), color: "var(--success)" },
            { key: "cost", label: t("cost"), color: "var(--destructive)", variant: "line" },
          ]}
        />
      </ChartCard>
    </div>
  );
}

const SEGMENT_COLORS = ["bg-info", "bg-success", "bg-accent-purple", "bg-warning", "bg-accent-teal"] as const;

function BreakdownCard({
  title,
  entries,
  total,
  labelKey,
}: {
  title: string;
  entries: [string, number][];
  total: number;
  labelKey: "expenseLabels" | "incomeLabels";
}) {
  const t = useTranslations("cattle.detail.finance");
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border p-4">
      <p className="text-sm font-semibold text-foreground">{title}</p>
      {total === 0 ? (
        <p className="text-sm text-muted-foreground">{t("noData")}</p>
      ) : (
        <TooltipProvider delayDuration={100}>
          <div className="flex h-9 w-full gap-0.5 overflow-hidden rounded-lg">
            {entries.map(([key, value], i) => {
              const pct = total > 0 ? (value / total) * 100 : 0;
              if (pct <= 0) return null;
              return (
                <Tooltip key={key}>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "h-full cursor-pointer transition-opacity hover:opacity-85 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        SEGMENT_COLORS[i % SEGMENT_COLORS.length],
                      )}
                      style={{ width: `${pct}%` }}
                      role="img"
                      aria-label={`${t(`${labelKey}.${key}`)}: ${value}`}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top">
                    <div className="flex items-center gap-1.5 text-xs font-medium">
                      <span>{t(`${labelKey}.${key}`)}:</span>
                      <MoneyText amount={value} />
                      <span className="font-normal text-muted-foreground">({pct.toFixed(1)}%)</span>
                    </div>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {entries.map(([key, value], i) => (
              <Tooltip key={key}>
                <TooltipTrigger asChild>
                  <div className="flex cursor-pointer items-center gap-1.5 transition-opacity hover:opacity-80">
                    <span className={cn("size-2 rounded-full", SEGMENT_COLORS[i % SEGMENT_COLORS.length])} />
                    <p className="text-xs font-medium text-muted-foreground">{t(`${labelKey}.${key}`)}</p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <div className="flex items-center gap-1.5 text-xs font-medium">
                    <span>{t(`${labelKey}.${key}`)}:</span>
                    <MoneyText amount={value} />
                    {total > 0 && (
                      <span className="font-normal text-muted-foreground">
                        ({((value / total) * 100).toFixed(1)}%)
                      </span>
                    )}
                  </div>
                </TooltipContent>
              </Tooltip>
            ))}
          </div>
        </TooltipProvider>
      )}
    </div>
  );
}
