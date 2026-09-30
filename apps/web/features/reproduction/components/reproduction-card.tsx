import { cn } from "@/lib/utils";

/** Local card chrome for this module's widgets — matches the app-wide card language (`rounded-2xl
 * bg-card shadow-card`) without reaching into another feature's internals (ARCHITECTURE.md §3),
 * same pattern as `features/milk/components/milk-card.tsx`.
 *
 * Every card is a **container-query root** (`@container`): its children lay themselves out from the
 * card's own width (`@md:` / `@3xl:` …), not the viewport's — so the same widget is right whether it
 * sits full-width, in a side column, or beside an expanded sidebar. The header wraps its right slot
 * under the title instead of squeezing it, and padding scales fluidly with `clamp()`. */
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
        "@container flex min-w-0 flex-col gap-4 rounded-2xl bg-card p-[clamp(0.875rem,0.6rem+1vw,1.25rem)] shadow-card",
        className,
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-48 flex-col gap-0.5">
          <h2 className="text-base font-semibold text-foreground">{title}</h2>
          {description ? <p className="text-xs text-muted-foreground">{description}</p> : null}
        </div>
        {headerRight ? <div className="flex max-w-full flex-wrap items-center gap-2">{headerRight}</div> : null}
      </header>
      {children}
    </section>
  );
}
