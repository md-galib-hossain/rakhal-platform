"use client"; // dropdown interaction

import { useTranslations } from "next-intl";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { DashboardPeriod } from "../types";

/** Real period toggle styled as the Figma pill (732:1727/732:1792) — used by the two widgets that
 * actually have a period-scoped backend query (`ProductionSummaryCard`, `LivestockStateChart`). */
export function PeriodSelect({
  value,
  onChange,
}: {
  value: DashboardPeriod;
  onChange: (period: DashboardPeriod) => void;
}) {
  const t = useTranslations("dashboard.period");
  return (
    <Select value={value} onValueChange={(v) => onChange(v as DashboardPeriod)}>
      <SelectTrigger
        aria-label={t("selectPeriod") || "Select period"}
        className="h-auto w-auto gap-1.5 rounded-md border-border px-2 py-1.5 text-xs font-medium text-muted-foreground shadow-xs [&_svg]:size-3.5"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="today">{t("today")}</SelectItem>
        <SelectItem value="week">{t("week")}</SelectItem>
        <SelectItem value="month">{t("month")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
