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

  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span
        className="inline-flex w-fit items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-foreground"
        aria-label={`${labels.vsPrevious}: ${absText ? `${absText}, ` : ""}${pctText}`}
      >
        <Icon className="size-3.5 text-muted-foreground" aria-hidden />
        <span aria-hidden>{pctText}</span>
        {absText ? (
          <span aria-hidden className="font-normal text-muted-foreground">
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
