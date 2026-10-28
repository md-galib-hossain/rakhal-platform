"use client"; // segment + period URL state

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { TrendingUp, ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateRangePicker } from "@/components/shared/date-range-picker";
import { usePeriod } from "@/lib/hooks/use-period";
import { AgingSummaryStrip } from "../payments/aging-summary-strip";
import { ProfitLossReportView } from "./profit-loss-report";
import { CashFlowReportView } from "./cash-flow-report";

const REPORT_KEYS = ["profit-loss", "cash-flow", "receivable-aging", "payable-aging"] as const;
type ReportKey = (typeof REPORT_KEYS)[number];

const REPORT_ICONS: Record<ReportKey, typeof TrendingUp> = {
  "profit-loss": TrendingUp,
  "cash-flow": ArrowLeftRight,
  "receivable-aging": ArrowDownToLine,
  "payable-aging": ArrowUpFromLine,
};

/**
 * RAKHAL-387 (MILESTONE 22) — Finance → Reports tab (`BUSINESS_IA_PRD.md` §5.6, §9.2). Exactly the
 * four reports the AC names: **P&L · Cash Flow · Receivable Aging · Payable Aging**. A `report` URL
 * param drives the segment (own nuqs instance, distinct from `FinanceTabs`' own `tab` param — same
 * pattern the deleted `LedgerView`'s `doc` param used). **Trial Balance is deliberately absent** —
 * it is Owner-only, gated behind `finance.accounting`, URL-reachable only (its own client is
 * RAKHAL-393/future scope; adding it here would violate ADR-022/§9.2's explicit "do not restore"
 * instruction). P&L/Cash Flow share one `DateRangePicker` (`usePeriod()`, RAKHAL-380); the two aging
 * reports are point-in-time (`AgingSummaryStrip`, reused as-is from `../payments/` — same component
 * the Receivables/Payables screens mount, RAKHAL-386) and never take a period.
 */
export function ReportsView() {
  const t = useTranslations("finance.reportsV2");
  const [segment, setSegment] = useQueryState("report", parseAsStringEnum<ReportKey>([...REPORT_KEYS]).withDefault("profit-loss"));
  const period = usePeriod("this_month");
  const tPreset = useTranslations("period.presets");

  const isPeriodReport = segment === "profit-loss" || segment === "cash-flow";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={segment} onValueChange={(v) => void setSegment(v as ReportKey)}>
          <TabsList className="h-auto flex-wrap sm:h-11">
            {REPORT_KEYS.map((key) => {
              const Icon = REPORT_ICONS[key];
              return (
                <TabsTrigger key={key} value={key}>
                  <Icon className="mr-1.5 size-4" aria-hidden />
                  {t(`segments.${key.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())}`)}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>

        {isPeriodReport ? (
          <DateRangePicker
            preset={period.preset}
            range={{ from: period.from, to: period.to }}
            label={tPreset(period.preset === "custom" ? "custom" : period.preset)}
            onPresetChange={period.setPreset}
            onRangeChange={period.setRange}
          />
        ) : null}
      </div>

      {segment === "profit-loss" ? <ProfitLossReportView range={{ from: period.from, to: period.to }} /> : null}
      {segment === "cash-flow" ? <CashFlowReportView range={{ from: period.from, to: period.to }} /> : null}
      {segment === "receivable-aging" ? <AgingSummaryStrip kind="RECEIVABLE" /> : null}
      {segment === "payable-aging" ? <AgingSummaryStrip kind="PAYABLE" /> : null}
    </div>
  );
}
