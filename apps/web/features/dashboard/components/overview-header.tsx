import { Calendar } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";

/**
 * Today's-date pill matching the Figma "Dashboard" frame's page header (732:1715/732:1718) — same
 * chrome as `DashboardCard`'s `PeriodPill` (white, bordered, drop shadow). Used as the `actions`
 * slot of the shared `PageCard` wrapper (`components/shared/page-card.tsx`), which now owns the
 * title row this component used to render itself.
 */
export function TodayDatePill({ locale }: { locale: Locale }) {
  return (
    <span className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-2 text-xs font-medium text-muted-foreground shadow-xs">
      {formatDate(new Date(), locale)}
      <Calendar className="size-3.5" aria-hidden />
    </span>
  );
}
