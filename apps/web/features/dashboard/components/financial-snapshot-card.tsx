"use client"; // live query

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { useFinancialSnapshot } from "../hooks/use-dashboard-widgets";

function Row({ label, current, changePct }: { label: string; current: number; changePct: number | null }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="flex items-center gap-2">
        <MoneyText amount={current} colorize className="font-medium" />
        {changePct != null ? (
          <span className={changePct >= 0 ? "text-xs text-success" : "text-xs text-destructive"}>
            {changePct >= 0 ? "+" : ""}
            {changePct}%
          </span>
        ) : null}
      </span>
    </div>
  );
}

export function FinancialSnapshotCard() {
  const t = useTranslations("dashboard.financialSnapshot");
  const query = useFinancialSnapshot();

  if (query.isLoading) return <CardSkeleton lines={4} />;
  if (query.isError) {
    return (
      <Card>
        <CardContent className="pt-6">
          <ErrorState description={t("error")} onRetry={() => query.refetch()} />
        </CardContent>
      </Card>
    );
  }
  const data = query.data;
  if (!data) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Row label={t("income")} current={data.income.current} changePct={data.income.changePct} />
        <Row label={t("expenses")} current={data.expenses.current} changePct={data.expenses.changePct} />
        <div className="border-t border-border pt-3">
          <Row label={t("profit")} current={data.profit.current} changePct={data.profit.changePct} />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-3 text-sm">
          <span className="text-muted-foreground">{t("survivalRunway")}</span>
          <span className="font-medium text-foreground">{t("daysValue", { days: data.survivalRunway.days })}</span>
        </div>
      </CardContent>
    </Card>
  );
}
