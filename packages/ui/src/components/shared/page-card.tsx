import { cn } from "../../lib/utils";

/**
 * Whole-page content wrapper: one large card holding the page's title/actions header row and all
 * of its child cards, instead of the title floating on the bare page background above independent
 * cards. User-requested pattern (2026-07-11) — not pulled from Figma (the Dashboard frame's own
 * `732:1714` container has no fill/shadow of its own, confirmed via the Figma plugin), reuses the
 * same visual language as `DashboardCard`'s established chrome so it doesn't invent a new card
 * style. Ends exactly where the last child card ends (no extra bottom chrome).
 */
export function PageCard({
  title,
  actions,
  children,
  className,
}: {
  title: string;
  /** Right-aligned header slot — a date pill, filter, action button, or omitted entirely. */
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-card",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        {actions}
      </div>
      {children}
    </div>
  );
}
