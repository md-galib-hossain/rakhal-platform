"use client";

import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import type { SalesSummary } from "../../types";

/** RAKHAL-388 — "Top Buyers" list: name + amount (`BUSINESS_IA_PRD.md` §5.7), straight off
 * `SalesSummary.topBuyers` (top 5, `SalesSummaryService.queryTopBuyers`). */
export function TopBuyersList({
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
  const t = useTranslations("sales.overview.topBuyers");

  if (isLoading) return <CardSkeleton lines={5} className="rounded-2xl" />;
  if (isError) {
    return (
      <Card className="rounded-2xl">
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-base">{t("title")}</CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <ErrorState description={t("error")} onRetry={onRetry} />
        </CardContent>
      </Card>
    );
  }

  const buyers = data?.topBuyers ?? [];

  return (
    <Card className="rounded-2xl">
      <CardHeader className="p-4 pb-3">
        <CardTitle className="text-base">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 p-4 pt-0">
        {buyers.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{t("empty")}</p>
        ) : (
          buyers.map((buyer, i) => (
            <div key={buyer.customerId} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                  {i + 1}
                </span>
                <span className="text-sm font-medium text-foreground">{buyer.name}</span>
              </div>
              <MoneyText amount={Number(buyer.amount)} className="text-sm font-medium" />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
