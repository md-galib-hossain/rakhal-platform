import { Calendar } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";

/** Matches the Figma "Dashboard" frame's page header (732:1715 — this app's page-header wrapper
 * layer, missed in the first pixel-match pass): a bold "Overview" title on the left and a static
 * today's-date pill on the right, in the same chrome as `PeriodPill` (white, bordered, drop shadow).
 * Distinct from the shared `PageHeader` (breadcrumbs + action-button slot) — this page has neither,
 * just the date — so it gets its own small component rather than overloading the generic one. */
export function OverviewHeader({ title, locale }: { title: string; locale: Locale }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h1 className="text-2xl font-bold text-foreground">{title}</h1>
      <span className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-2 text-xs font-medium text-muted-foreground shadow-xs">
        {formatDate(new Date(), locale)}
        <Calendar className="size-3.5" aria-hidden />
      </span>
    </div>
  );
}
