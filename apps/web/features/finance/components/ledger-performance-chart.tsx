"use client"; // dynamic chart import + margin/debt-to-asset side stats

import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Skeleton } from "@/components/ui/skeleton";
import type { LedgerChart } from "../types";

const LedgerPerformanceChartInner = dynamic(() => import("./ledger-performance-chart-inner"), {
  ssr: false,
  loading: () => <Skeleton className="h-[220px] w-full" />,
});

const LEGEND = [
  { key: "income", color: "#007fff" },
  { key: "expense", color: "#f43f5e" },
  { key: "profit", color: "#10b981" },
] as const;

/** Figma "Financial Performance Over Time" card (node `1039:24980`) + its two side stats
 * ("Operating Margin"/"Debt to Asset", `1039:25083`/`1039:25090`) — all three sourced from the one
 * `GET /finance/ledger` response's `meta.chart` (`finance.service.ts#ledgerChart`), recomputed
 * year-to-date on every ledger fetch. */
export function LedgerPerformanceChart({ chart }: { chart: LedgerChart | undefined }) {
  const t = useTranslations("finance.ledger.chart");
  const labels = { income: t("income"), expense: t("expense"), profit: t("profit") };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-4 sm:flex-row">
      <div className="flex flex-1 flex-col gap-3">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xl font-medium text-foreground">{t("title")}</p>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {LEGEND.map((item) => (
              <div key={item.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span aria-hidden className="h-1.5 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                {labels[item.key as keyof typeof labels]}
              </div>
            ))}
          </div>
        </div>
        <LedgerPerformanceChartInner months={chart?.yearly ?? []} labels={labels} />
      </div>
      <div className="flex shrink-0 flex-row gap-3 sm:w-40 sm:flex-col">
        <div className="flex flex-1 flex-col gap-1 rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">{t("operatingMargin")}</p>
          <p className="text-xl font-bold text-foreground">{chart ? `${chart.operatingMarginPct}%` : "—"}</p>
        </div>
        <div className="flex flex-1 flex-col gap-1 rounded-xl border border-border p-3">
          <p className="text-xs text-muted-foreground">{t("debtToAsset")}</p>
          <p className="text-xl font-bold text-foreground">{chart ? `${chart.debtToAssetPct}%` : "—"}</p>
        </div>
      </div>
    </div>
  );
}
