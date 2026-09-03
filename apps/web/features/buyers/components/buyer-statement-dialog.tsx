"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MoneyText } from "@/components/shared/money-text";
import { DateText } from "@/components/shared/date-text";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useBuyerStatement } from "../hooks/use-buyers";
import type { Buyer } from "../types";

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

/** Monthly Statement (PRD §11.3) — reconciles dispatched vs accepted volume, quality adjustments,
 * and amount due vs paid for one buyer over a chosen month. No Figma frame — built PRD-spec against
 * the real `GET /buyers/:id/statement?month=YYYY-MM`. */
export function BuyerStatementDialog({
  buyer,
  open,
  onOpenChange,
}: {
  buyer: Buyer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("buyers.statement");
  const [month, setMonth] = useState(currentMonth());
  const query = useBuyerStatement(buyer?.id ?? null, month);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5 sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{t("title", { name: buyer?.name ?? "" })}</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="statement-month">{t("month")}</Label>
            <Input id="statement-month" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
          </div>

          {query.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : query.isError ? (
            <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
          ) : query.data ? (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-3">
                <StatRow label={t("totalDispatchedL")} value={`${query.data.totalDispatchedL} L`} />
                <StatRow label={t("totalReceivedL")} value={`${query.data.totalReceivedL} L`} />
                <StatRow label={t("baseAmount")} value={<MoneyText amount={query.data.baseAmount} />} />
                <StatRow label={t("qualityAdjustments")} value={<MoneyText amount={query.data.qualityAdjustments} />} />
                <StatRow label={t("totalDue")} value={<MoneyText amount={query.data.totalDue} />} />
                <StatRow label={t("totalPaid")} value={<MoneyText amount={query.data.totalPaid} />} />
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border p-3 text-base font-bold">
                <p className="text-foreground">{t("outstanding")}</p>
                <p className="text-primary">
                  <MoneyText amount={query.data.outstanding} />
                </p>
              </div>

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
      </SheetContent>
    </Sheet>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
