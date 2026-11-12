import { cn } from "@/lib/utils";

/**
 * Local card chrome for this module's widgets — matches the app-wide card language (`rounded-2xl
 * bg-card shadow-card`, see `app/globals.css`) without reaching into `features/dashboard/**`'s
 * internals (ARCHITECTURE.md §3 import rules: features only import other features via a public
 * `index.ts`, which `features/dashboard` doesn't expose).
 */
export function MilkCard({
  title,
  titleExtra,
  headerRight,
  children,
  className,
}: {
  title: string;
  /** Rendered under the title, in the same left column (e.g. the Milk Log's search box). */
  titleExtra?: React.ReactNode;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 rounded-2xl bg-card p-4 shadow-card", className)}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-3">
          <p className="text-base font-medium text-foreground">{title}</p>
          {titleExtra}
        </div>
        {headerRight}
      </div>
      {children}
    </div>
  );
}
