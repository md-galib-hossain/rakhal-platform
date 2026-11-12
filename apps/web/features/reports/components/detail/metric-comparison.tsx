import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import type { Locale } from "@/lib/constants/i18n";
import { cn } from "@/lib/utils";
import { formatMetricValue, formatPercentChange, NOT_APPLICABLE_DASH } from "../../lib/format";
import type { ReportTranslator } from "../../lib/labels";
import type { MetricResult } from "../../types";

/**
 * Change vs the previous period. Always neutral in tone: a rise in "cases opened" is not good news and a drop in
 * milk is not bad news without a defined direction, so no red/green judgement is made here. `percentChange: null`
 * (previous was 0 / not a value) is an em dash, never "0%".
 */
export function MetricComparison({
  comparison,
  labels,
  locale,
  tr,
  className,
}: {
  comparison: NonNullable<MetricResult["comparison"]>;
  labels: { previous: string; vsPrevious: string };
  locale: Locale;
  tr: ReportTranslator;
  className?: string;
}) {
  const { absoluteChange, percentChange, current, previous } = comparison;
  const unit = current.state === "value" ? current.unit : previous.state === "value" ? previous.unit : "";
  const absText =
    absoluteChange !== null && Number.isFinite(absoluteChange) && unit
      ? `${absoluteChange > 0 ? "+" : absoluteChange < 0 ? "−" : ""}${formatMetricValue(
          { state: "value", value: Math.abs(absoluteChange), unit },
          locale,
          tr,
        )}`
      : null;
  const pctText = formatPercentChange(percentChange);
  const Icon =
    percentChange === null || !Number.isFinite(percentChange) || percentChange === 0
      ? ArrowRight
      : percentChange > 0
        ? ArrowUpRight
        : ArrowDownRight;
  const previousText =
    previous.state === "not_applicable" ? NOT_APPLICABLE_DASH : formatMetricValue(previous, locale, tr);

  const isPositive = percentChange !== null && Number.isFinite(percentChange) && percentChange > 0;
  const isNegative = percentChange !== null && Number.isFinite(percentChange) && percentChange < 0;

  const toneClass = isPositive
    ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
    : isNegative
      ? "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
      : "bg-muted text-foreground border border-border/60";

  const iconClass = isPositive
    ? "text-emerald-600 dark:text-emerald-400"
    : isNegative
      ? "text-rose-600 dark:text-rose-400"
      : "text-muted-foreground";

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span
        className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold", toneClass)}
        aria-label={`${labels.vsPrevious}: ${absText ? `${absText}, ` : ""}${pctText}`}
      >
        <Icon className={cn("size-3.5", iconClass)} aria-hidden />
        <span aria-hidden>{pctText}</span>
        {absText ? (
          <span aria-hidden className="font-normal opacity-85">
            ({absText})
          </span>
        ) : null}
      </span>
      <span className="text-xs text-muted-foreground">
        {labels.previous}: {previousText}
      </span>
    </div>
  );
}
