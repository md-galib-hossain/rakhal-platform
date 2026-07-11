import { cn } from "@/lib/utils";

/**
 * Local card chrome for this module's widgets — matches the app-wide card language (`rounded-2xl
 * bg-card shadow-card`, see `app/globals.css`) without reaching into `features/dashboard/**`'s
 * internals (ARCHITECTURE.md §3 import rules: features only import other features via a public
 * `index.ts`, which `features/dashboard` doesn't expose).
 */
export function MilkCard({
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
