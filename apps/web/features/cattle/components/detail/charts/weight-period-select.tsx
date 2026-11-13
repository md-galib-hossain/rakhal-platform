"use client"; // dropdown interaction

import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@rakhal/ui/ui/select";
import type { WeightHistoryPeriod } from "../../../detail-types";

/** Day/week/month/year toggle for the Overview weight-history chart — same structural pattern as
 * `features/dashboard/components/period-select.tsx`, a sibling rather than a shared component
 * since that one is dashboard-scoped and only has 3 options (today/week/month). */
export function WeightPeriodSelect({
  value,
  onChange,
}: {
  value: WeightHistoryPeriod;
  onChange: (period: WeightHistoryPeriod) => void;
}) {
  const t = useTranslations("cattle.detail.performance.weightPeriod");
  return (
    <Select value={value} onValueChange={(v) => onChange(v as WeightHistoryPeriod)}>
      <SelectTrigger className="h-auto w-auto gap-1.5 rounded-md border-border px-2 py-1.5 text-xs font-medium text-muted-foreground shadow-xs [&_svg]:size-3.5">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="day">{t("day")}</SelectItem>
        <SelectItem value="week">{t("week")}</SelectItem>
        <SelectItem value="month">{t("month")}</SelectItem>
        <SelectItem value="year">{t("year")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
