"use client"; // live query + URL-synced tab switch + period picker

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { ChevronRight, TrendingDown, TrendingUp } from "lucide-react";
import { CardSkeleton } from "@rakhal/ui/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { cn } from "@/lib/utils";
import { formatSignedPct } from "@/lib/format";
import { usePeriod } from "@/lib/hooks/use-period";
import { usePeriodSummary, usePositionSummary } from "./overview/hooks";
import { FINANCE_TABS, type FinanceTabKey } from "../types";

const TAB_KEYS = FINANCE_TABS.map((t) => t.key) as [FinanceTabKey, ...FinanceTabKey[]];

function KpiTile({
  label,
  value,
  subtitle,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  subtitle?: React.ReactNode;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "flex flex-1 flex-col justify-between gap-2 rounded-xl border border-border p-3 text-left",
        onClick && "transition-colors hover:border-primary/50 hover:bg-accent/40",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {onClick ? <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden /> : null}
      </div>
      <div className="flex flex-col gap-1">
        <div className="text-2xl font-bold text-foreground">{value}</div>
        {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
      </div>
    </Wrapper>
  );
}

/** `changePct: null` renders "—", never "0%"/"∞" — RAKHAL-383's own AC, matches
 * `PeriodSummaryService`'s own `changePct` doc comment (division-by-zero-previous case). */
function ChangePill({ changePct }: { changePct: number | null }) {
  if (changePct == null) {
    return <span className="inline-flex items-center text-xs font-medium text-muted-foreground">—</span>;
  }
  const positive = changePct >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-medium", positive ? "text-success" : "text-destructive")}>
      <Icon className="size-3" aria-hidden />
      {formatSignedPct(changePct)}
    </span>
  );
}

/**
 * RAKHAL-383 (MILESTONE 22) — Row A + Row B, rebuilt on `GET /finance/summary` (RAKHAL-371),
 * replacing RAKHAL-360's dual-endpoint version (`GET /finance/balance` + the dashboard's
 * `financial-snapshot`) and its "not yet available" receivable/payable text — RAKHAL-371 retired
 * `BalanceService.getReceivablePayablePosition` and `/finance/summary` now returns real
 * `totalReceivable`/`totalPayable` numbers.
 *
 * **Row A (position) uses `usePositionSummary()` — a separate query from Row B, deliberately.**
 * `qk.finance.summaryPositionV2()` carries no period argument, so it never refetches when the
 * `DateRangePicker` below changes — the AC's literal requirement, made real by the query-cache key
 * split (`hooks.ts`'s own doc comment), not just true by the backend also ignoring `from`/`to` for
 * `position`. Each Row A card is a button that switches the Finance tab bar to its own detail tab.
 *
 * **Row B (period metrics) uses `usePeriodSummary(range)`**, `range` from RAKHAL-380's `usePeriod()`
 * — refetches correctly on every period change via `toPeriodKey`. "Rakhal Balance" → "Available
 * Balance" is an i18n string change only; the API field stays `rakhalBalance`-shaped internally
 * (`position.availableBalance` here) per the AC's own explicit instruction not to churn the field.
 */
export function FinanceHighlights() {
  const t = useTranslations("finance.overview");
  const tPreset = useTranslations("period.presets");
  const [, setTab] = useQueryState("tab", parseAsStringEnum<FinanceTabKey>(TAB_KEYS).withDefault("overview"));
  const period = usePeriod("this_month");

  const positionQuery = usePositionSummary();
  const periodQuery = usePeriodSummary({ from: period.from, to: period.to });

  return (
    <div className="flex flex-col gap-4">
      {/* Row A — position, period-independent */}
      {positionQuery.isLoading ? (
        <CardSkeleton lines={2} className="rounded-2xl" />
      ) : positionQuery.isError ? (
        <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
          <ErrorState onRetry={() => void positionQuery.refetch()} />
        </div>
      ) : positionQuery.data ? (
        <div className="flex flex-col gap-3 sm:flex-row">
          <KpiTile
            label={t("rowA.availableBalance")}
            value={<MoneyText amount={Number(positionQuery.data.availableBalance)} />}
            subtitle={t("rowA.acrossAccounts", { count: positionQuery.data.accountCount })}
            onClick={() => void setTab("accounts")}
          />
          <KpiTile
            label={t("rowA.totalReceivable")}
            value={<MoneyText amount={Number(positionQuery.data.totalReceivable)} />}
            subtitle={t("rowA.invoiceCount", { count: positionQuery.data.receivableCount })}
            onClick={() => void setTab("receivables")}
          />
          <KpiTile
            label={t("rowA.totalPayable")}
            value={<MoneyText amount={Number(positionQuery.data.totalPayable)} />}
            subtitle={t("rowA.billCount", { count: positionQuery.data.payableCount })}
            onClick={() => void setTab("payables")}
          />
        </div>
      ) : null}

      {/* Row B — selected period */}
      <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{period.label}</p>
          <DateRangePicker preset={period.preset} range={{ from: period.from, to: period.to }} label={tPreset(period.preset === "custom" ? "custom" : period.preset)} onPresetChange={period.setPreset} onRangeChange={period.setRange} />
        </div>

        {periodQuery.isLoading ? (
          <CardSkeleton lines={2} />
        ) : periodQuery.isError ? (
          <ErrorState onRetry={() => void periodQuery.refetch()} />
        ) : periodQuery.data ? (
          <div className="flex flex-col gap-3 sm:flex-row">
            <KpiTile label={t("rowB.revenue")} value={<MoneyText amount={periodQuery.data.revenue.current} />} subtitle={<ChangePill changePct={periodQuery.data.revenue.changePct} />} />
            <KpiTile label={t("rowB.expenses")} value={<MoneyText amount={periodQuery.data.expenses.current} />} subtitle={<ChangePill changePct={periodQuery.data.expenses.changePct} />} />
            <KpiTile label={t("rowB.netProfit")} value={<MoneyText amount={periodQuery.data.netProfit.current} colorize />} subtitle={<ChangePill changePct={periodQuery.data.netProfit.changePct} />} />
            <KpiTile label={t("rowB.netCashFlow")} value={<MoneyText amount={periodQuery.data.netCashFlow.current} colorize />} subtitle={<ChangePill changePct={periodQuery.data.netCashFlow.changePct} />} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
