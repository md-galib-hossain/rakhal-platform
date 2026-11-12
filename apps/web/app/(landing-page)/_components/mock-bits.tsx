import { cn } from "@/lib/utils";

/**
 * Tiny CSS-only dashboard mockup pieces (no images — replaceable with real screenshots later).
 * All display values here are decorative placeholders, not product data.
 */

export function MockBars({
  values,
  className,
  barClassName,
}: {
  values: number[];
  className?: string;
  barClassName?: string;
}) {
  return (
    <div aria-hidden className={cn("flex h-20 items-end gap-1.5", className)}>
      {values.map((v, i) => (
        <div
          key={i}
          style={{ height: `${v}%` }}
          className={cn("w-full rounded-t-sm bg-primary/80", i % 3 === 1 && "bg-warning/70", barClassName)}
        />
      ))}
    </div>
  );
}

export function MockStat({
  label,
  value,
  delta,
  tone = "default",
  dark = false,
}: {
  label: string;
  value: string;
  delta?: string;
  tone?: "default" | "good" | "warn" | "bad";
  dark?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-4",
        dark ? "border-sidebar-foreground/10 bg-sidebar-foreground/5" : "border-border bg-card",
      )}
    >
      <p className={cn("text-xs font-medium", dark ? "text-sidebar-muted" : "text-muted-foreground")}>{label}</p>
      <p
        className={cn(
          "mt-1.5 text-2xl font-bold",
          dark ? "text-sidebar-foreground" : "text-foreground",
          tone === "good" && "text-primary",
          tone === "warn" && "text-warning",
          tone === "bad" && "text-destructive",
        )}
      >
        {value}
      </p>
      {delta ? (
        <span className="mt-2 inline-block rounded-full bg-success-tint px-2 py-0.5 text-xs font-semibold text-primary">
          {delta}
        </span>
      ) : null}
    </div>
  );
}
