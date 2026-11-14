"use client"; // live query

import { useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { formatSignedPct } from "@/lib/format";
import { useFinancialSnapshot } from "../hooks/use-dashboard-widgets";
import { DashboardCard } from "./dashboard-card";

function Row({ label, current, changePct }: { label: string; current: number; changePct: number | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <MoneyText amount={current} colorize className="font-medium" />
        {changePct != null ? (
          <span className={changePct >= 0 ? "text-xs text-success" : "text-xs text-destructive"}>
            {formatSignedPct(changePct)}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** RAKHAL-360 note: `GET /dashboard/financial-snapshot` was additively re-pointed at Finance V2
 * ledger activity by RAKHAL-351 (V1 `FinanceTransaction` rows still count too, until RAKHAL-354
 * deletes V1) — confirmed by reading `dashboard.service.ts#financialSnapshot`/`txnSum` directly.
 * This component's own shape/logic is unchanged; it already consumed exactly this route and needed
 * no code change, only this confirmation note. `features/finance/components/finance-highlights.tsx`
 * (Finance module's own summary card) reuses this same hook for its month-KPI row. */
export function FinancialSnapshotCard() {
  const t = useTranslations("dashboard.financialSnapshot");
  const query = useFinancialSnapshot();

  if (query.isLoading) return <CardSkeleton lines={4} className="h-full min-h-[360px] rounded-2xl" />;
  if (query.isError) {
    return (
      <DashboardCard title={t("title")} className="min-h-[360px]">
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </DashboardCard>
    );
  }
  const data = query.data;
  if (!data) return null;

  return (
    <DashboardCard title={t("title")} className="min-h-[360px]">
      <div className="flex flex-1 flex-col justify-between gap-3">
        <Row label={t("income")} current={data.income.current} changePct={data.income.changePct} />
        <Row label={t("expenses")} current={data.expenses.current} changePct={data.expenses.changePct} />
        <div className="border-t border-border pt-3">
          <Row label={t("profit")} current={data.profit.current} changePct={data.profit.changePct} />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">{t("survivalRunway")}</span>
          <span className="font-medium text-foreground">{t("daysValue", { days: data.survivalRunway.days })}</span>
        </div>
      </div>
    </DashboardCard>
  );
}
