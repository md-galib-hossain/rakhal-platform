import { cn } from "@/lib/utils";

/**
 * Whole-page content wrapper: one large card holding the page's title/actions header row and all
 * of its child cards, instead of the title floating on the bare page background above independent
 * cards.
 *
 * Stretches to at least the full viewport height (`min-h-[calc(100vh-6.75rem)] flex-1`) so that
 * short or empty pages do not awkwardly terminate halfway down the screen with bare background
 * beneath them, maintaining vertical alignment with the sticky sidebar.
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
        "flex flex-1 flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-card min-h-[calc(100vh-6.75rem)]",
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
