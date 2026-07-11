"use client"; // live query

import { useLocale, useTranslations } from "next-intl";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { formatNumber } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useMilkOverview } from "../hooks/use-milk";
import { MilkCard } from "./milk-card";

/** Today's total/sellable/withholding + comparisons to yesterday/last week/last year, and each
 * active session's submit status — backed by the real `GET /milk/overview` (`milk.service.ts`).
 * `costPerLitreToday`/`marketValueToday` are always `null` on the real backend (Finance/Settings
 * wiring not built yet) — not rendered, rather than showing a fake ৳0. */
export function MilkOverviewCard() {
  const t = useTranslations("milk.overview");
  const locale = useLocale() as Locale;
  const query = useMilkOverview();

  if (query.isLoading) return <CardSkeleton lines={4} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <MilkCard title={t("title")}>
        <ErrorState description={t("error")} onRetry={() => query.refetch()} />
      </MilkCard>
    );
  }

  const data = query.data;
  const num = (v: number) => formatNumber(v, locale, { maximumFractionDigits: 1 });

  return (
    <MilkCard title={t("title")} className="lg:col-span-2">
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <p className="text-2xl font-semibold text-foreground">{num(data?.today.totalL ?? 0)}</p>
          <p className="text-xs text-muted-foreground">{t("totalToday")}</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-success">{num(data?.today.sellableL ?? 0)}</p>
          <p className="text-xs text-muted-foreground">{t("sellable")}</p>
        </div>
        <div>
          <p className="text-2xl font-semibold text-warning">{num(data?.today.withholdingL ?? 0)}</p>
          <p className="text-xs text-muted-foreground">{t("withholding")}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-4 border-t border-border pt-4 text-center">
        <div>
          <p className="text-sm font-medium text-foreground">{num(data?.yesterday.totalL ?? 0)}</p>
          <p className="text-xs text-muted-foreground">{t("yesterday")}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{num(data?.sameDayLastWeek.totalL ?? 0)}</p>
          <p className="text-xs text-muted-foreground">{t("lastWeek")}</p>
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">{num(data?.sameDayLastYear.totalL ?? 0)}</p>
          <p className="text-xs text-muted-foreground">{t("lastYear")}</p>
        </div>
      </div>
      {data?.sessionsStatus ? (
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 border-t border-border pt-4 text-sm">
          {Object.entries(data.sessionsStatus).map(([session, status]) => (
            <div key={session} className="flex items-center gap-1.5">
              <span
                aria-hidden
                className={
                  "size-1.5 rounded-full " +
                  (status === "submitted" ? "bg-success" : status === "pending" ? "bg-warning" : "bg-muted-foreground")
                }
              />
              <span className="capitalize text-muted-foreground">{session}</span>
              <span className="font-medium text-foreground">{t(`sessionStatus.${status}`)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </MilkCard>
  );
}
