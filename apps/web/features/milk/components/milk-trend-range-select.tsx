"use client"; // dropdown interaction

import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MILK_TREND_RANGES, type MilkTrendRange } from "../types";

/** Range picker for "Production Trend Over Time" (Milk page + dashboard preview) — backs the real
 * `GET /milk/overview?range=` param (`MilkService#trend`), styled after the dashboard's own
 * `PeriodSelect` pill. */
export function MilkTrendRangeSelect({
  value,
  onChange,
}: {
  value: MilkTrendRange;
  onChange: (range: MilkTrendRange) => void;
}) {
  const t = useTranslations("milk.trend.range");
  return (
    <Select value={value} onValueChange={(v) => onChange(v as MilkTrendRange)}>
      <SelectTrigger className="h-auto w-auto gap-1.5 rounded-md border-border px-2 py-1.5 text-xs font-medium text-muted-foreground shadow-xs [&_svg]:size-3.5">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        {MILK_TREND_RANGES.map((range) => (
          <SelectItem key={range} value={range}>
            {t(range)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
