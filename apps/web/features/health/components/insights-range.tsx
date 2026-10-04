"use client"; // controlled radio group with click handlers

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

export const INSIGHTS_RANGES = ["30", "90", "365", "all"] as const;
export type InsightsRange = (typeof INSIGHTS_RANGES)[number];

/** Days sent to the API for a range; `undefined` = all time (the trend endpoint omits `days`). */
export function rangeDays(range: InsightsRange): number | undefined {
  return range === "all" ? undefined : Number(range);
}

/** The outcomes endpoint always needs a number — "all time" is the longest window it accepts (10 years). */
export const ALL_TIME_OUTCOME_DAYS = 3650;

/** One period control for the whole Insights tab — the trend chart and the outcomes both follow it. */
export function InsightsRangePicker({
  value,
  onChange,
}: {
  value: InsightsRange;
  onChange: (range: InsightsRange) => void;
}) {
  const t = useTranslations("health.insights");
  return (
    <div role="radiogroup" aria-label={t("range")} className="flex items-center gap-1 rounded-xl border border-border bg-muted p-1">
      {INSIGHTS_RANGES.map((r) => (
        <button
          key={r}
          type="button"
          role="radio"
          aria-checked={value === r}
          onClick={() => onChange(r)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            value === r ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {t(`rangeOption.${r}`)}
        </button>
      ))}
    </div>
  );
}
