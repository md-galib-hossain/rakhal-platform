"use client"; // month state + live query

import { currentMonthLocalIso } from "@/lib/local-date";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@rakhal/ui/ui/input";
import { Label } from "@rakhal/ui/ui/label";
import { Card } from "@rakhal/ui/ui/card";
import { MoneyText } from "@/components/shared/money-text";
import { DateText } from "@/components/shared/date-text";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { useBuyerStatement } from "../../hooks/use-buyers";

function currentMonth(): string {
  return currentMonthLocalIso();
}

/** RAKHAL-389 — buyer detail "Balance" tab: the existing monthly statement
 * (`GET /buyers/:id/statement?month=`, PRD §11.3) rendered inline instead of a dialog — same data
 * `BuyerStatementDialog`'s per-row "Statement" action already surfaces, reused via `useBuyerStatement`
 * rather than duplicating the fetch logic. */
export function BuyerBalanceTab({ buyerId }: { buyerId: string }) {
  const t = useTranslations("buyers.statement");
  const [month, setMonth] = useState(currentMonth());
  const query = useBuyerStatement(buyerId, month);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5 sm:w-64">
        <Label htmlFor="balance-month">{t("month")}</Label>
        <Input id="balance-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>

      {query.isLoading ? (
        <CardSkeleton lines={6} className="rounded-2xl" />
      ) : query.isError ? (
        <Card className="rounded-2xl p-4">
          <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
        </Card>
      ) : query.data ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            <StatTile label={t("totalDispatchedL")} value={`${query.data.totalDispatchedL} L`} />
            <StatTile label={t("totalReceivedL")} value={`${query.data.totalReceivedL} L`} />
            <StatTile label={t("baseAmount")} value={<MoneyText amount={query.data.baseAmount} />} />
            <StatTile label={t("qualityAdjustments")} value={<MoneyText amount={query.data.qualityAdjustments} />} />
            <StatTile label={t("totalDue")} value={<MoneyText amount={query.data.totalDue} />} />
            <StatTile label={t("totalPaid")} value={<MoneyText amount={query.data.totalPaid} />} />
          </div>
          <Card className="flex items-center justify-between rounded-xl p-3 text-base font-bold">
            <p className="text-foreground">{t("outstanding")}</p>
            <MoneyText amount={query.data.outstanding} className="text-primary" />
          </Card>

          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium text-foreground">{t("dispatchesTitle")}</p>
            {query.data.dispatches.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">{t("noDispatches")}</p>
            ) : (
              <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                {query.data.dispatches.map((d) => (
                  <div key={d.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                    <DateText date={d.dispatchedAt} />
                    <span>{d.volumeDispatchedL} L</span>
                    <MoneyText amount={d.calculatedAmount} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <Card className="flex flex-col gap-0.5 rounded-xl p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </Card>
  );
}
