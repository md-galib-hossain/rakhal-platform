import { cn } from "@/lib/utils";

/** Local card chrome for this module's widgets — matches the app-wide card language (`rounded-2xl
 * bg-card shadow-card`) without reaching into another feature's internals (ARCHITECTURE.md §3),
 * same pattern as `features/milk/components/milk-card.tsx`. */
export function ReproductionCard({
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
    <div className={cn("flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card", className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-base font-medium text-foreground">{title}</p>
        {headerRight}
      </div>
      {children}
    </div>
  );
}
