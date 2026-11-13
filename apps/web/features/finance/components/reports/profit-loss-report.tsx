"use client"; // live period-scoped query

import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { Card } from "@rakhal/ui/ui/card";
import type { PeriodRange } from "@/lib/period/presets";
import { useProfitLossReport } from "./hooks";
import type { ProfitLossLine } from "./types";

function LineRow({ line }: { line: ProfitLossLine }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1.5">
      <span className="text-sm text-foreground">{line.name}</span>
      <MoneyText amount={Number(line.amount)} className="text-sm font-medium" />
    </div>
  );
}

/** RAKHAL-387 — P&L report. `revenue.lines`/`expenses.lines` are already farmer-facing category
 * names (`ProfitLossReportService`'s own doc comment — "Milk Sales", "Feed", "Salary", never a
 * ledger account code), rendered verbatim, per the AC. Zero-activity accounts are dropped
 * server-side, so there is no "all-zero" row to filter here. */
export function ProfitLossReportView({ range }: { range: PeriodRange }) {
  const t = useTranslations("finance.reportsV2.profitLoss");
  const query = useProfitLossReport(range);

  if (query.isLoading) return <CardSkeleton lines={5} className="rounded-2xl" />;
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
    <Card className="flex flex-col gap-4 rounded-2xl p-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{t("revenue")}</p>
        <div className="flex flex-col divide-y divide-border">
          {data.revenue.lines.length === 0 ? (
            <p className="py-1.5 text-sm text-muted-foreground">{t("noActivity")}</p>
          ) : (
            data.revenue.lines.map((line) => <LineRow key={line.code} line={line} />)
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-1.5">
          <span className="text-sm font-semibold text-foreground">{t("totalRevenue")}</span>
          <MoneyText amount={Number(data.revenue.total)} colorize className="text-sm font-semibold" />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-foreground">{t("expenses")}</p>
        <div className="flex flex-col divide-y divide-border">
          {data.expenses.lines.length === 0 ? (
            <p className="py-1.5 text-sm text-muted-foreground">{t("noActivity")}</p>
          ) : (
            data.expenses.lines.map((line) => <LineRow key={line.code} line={line} />)
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border pt-1.5">
          <span className="text-sm font-semibold text-foreground">{t("totalExpenses")}</span>
          <MoneyText amount={Number(data.expenses.total)} colorize className="text-sm font-semibold" />
        </div>
      </div>

      <div className="flex items-center justify-between rounded-xl bg-muted p-3">
        <span className="text-base font-semibold text-foreground">{t("netProfit")}</span>
        <MoneyText amount={Number(data.netProfit)} colorize className="text-base font-bold" />
      </div>
    </Card>
  );
}
