import { cn } from "@/lib/utils";

/**
 * Standard card chrome for Reproduction module sections.
 * Matches `features/health/components/health-card.tsx` and `features/milk/components/milk-card.tsx`:
 * - Clear, prominent header with `text-xl font-medium text-foreground`
 * - Consistent border-border and shadow-card
 * - Responsive container queries and fluid padding
 * - Full height flex stretch with internal space distribution
 */
export function ReproductionCard({
  title,
  description,
  headerRight,
  children,
  className,
}: {
  title: string;
  description?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "@container flex h-full w-full min-w-0 flex-col justify-between gap-4 rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-card",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
          <h2 className="text-xl font-medium text-foreground tracking-tight">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {headerRight ? <div className="flex max-w-full flex-wrap items-center gap-2">{headerRight}</div> : null}
      </header>
      <div className="flex flex-1 flex-col justify-between">{children}</div>
    </section>
  );
}
