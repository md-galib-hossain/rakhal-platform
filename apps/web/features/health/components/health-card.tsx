/** Local card chrome for the Healthcare feature — mirrors `features/dashboard`'s `DashboardCard`
 * pixel-for-pixel (rounded-2xl/border/shadow-card/p-4), but kept feature-local rather than imported
 * cross-feature: `features/dashboard` has no public `index.ts`, and this codebase's established rule
 * (see `features/milk`'s own local `MilkCard`) is that each feature owns its own card chrome instead
 * of reaching into another feature's internals. */
export function HealthCard({
  title,
  titleExtra,
  headerRight,
  className,
  plain,
  children,
}: {
  title: string;
  /** Extra content next to the title (e.g. the "Decreasing" trend chip). */
  titleExtra?: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
  /** No border / shadow / padding — for a card that already sits inside another card (the Insights tab, RFE-140). */
  plain?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col gap-6 ${plain ? "" : "rounded-2xl border border-border bg-card p-4 shadow-card"} ${className ?? ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <p className="text-base font-medium text-foreground">{title}</p>
          {titleExtra}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}

/** Matches `features/dashboard/components/dashboard-card.tsx`'s `PeriodPill` exactly
 * (`rounded-md`, not `rounded-lg` — this project's `rounded-lg` is a big 16px card radius, not a
 * small-pill one; `rounded-md`/10px is the app-wide radius for buttons/inputs/small chrome). */
export function PeriodPill({ label }: { label: string }) {
  return (
    <span className="flex shrink-0 items-center gap-1.5 rounded-md border border-border px-2 py-1.5 text-xs font-medium text-muted-foreground shadow-xs">
      {label}
    </span>
  );
}
