/**
 * Card chrome pixel-matched against the Figma "Dashboard" frame's widget cards (file
 * SCfMPdxP6vgW1uTxfqCtz7, node 732:1656 — e.g. "Production Key Metrics" 732:1723, "Livestock
 * Count" 732:1737, "Livestock State" 732:1788): white rounded-[16px] card, soft shadow, 16px
 * padding, 24px gap between the header row and body. `headerRight` is a generic slot for the
 * header's period control — pass a real `<PeriodSelect/>` where a widget has one, a static pill
 * (`<PeriodPill/>`) where it doesn't, or omit it entirely.
 */
export function DashboardCard({
  title,
  headerRight,
  children,
  className,
}: {
  title: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        "flex flex-col gap-6 rounded-2xl bg-card p-4 shadow-[0px_0px_3px_rgba(0,0,0,0.1)] " + (className ?? "")
      }
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-medium text-foreground">{title}</p>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

/** Static, non-interactive period badge — matches the Figma pill's chrome for widgets that don't
 * (yet) have a real period toggle wired up. */
export function PeriodPill({ label }: { label: string }) {
  return (
    <span className="flex items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground shadow-xs">
      {label}
    </span>
  );
}
