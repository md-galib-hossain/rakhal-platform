import { cn } from "@/lib/utils";

/** Kicker pill + H2 + optional subtitle — the repeating section header of the landing page. */
export function SectionHeading({
  kicker,
  title,
  subtitle,
  align = "center",
  tone = "light",
  className,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
  align?: "center" | "left";
  tone?: "light" | "dark";
  className?: string;
}) {
  const dark = tone === "dark";
  return (
    <div className={cn("max-w-2xl", align === "center" && "mx-auto text-center", className)}>
      <span
        className={cn(
          "inline-block rounded-full border px-3.5 py-1 text-xs font-semibold uppercase tracking-widest",
          dark
            ? "border-sidebar-foreground/25 text-sidebar-muted"
            : "border-primary/30 bg-success-tint text-primary",
        )}
      >
        {kicker}
      </span>
      <h2
        className={cn(
          "mt-4 text-3xl font-bold leading-tight sm:text-4xl",
          dark ? "text-sidebar-foreground" : "text-foreground",
        )}
      >
        {title}
      </h2>
      {subtitle ? (
        <p className={cn("mt-4 text-lg", dark ? "text-sidebar-muted" : "text-muted-foreground")}>{subtitle}</p>
      ) : null}
    </div>
  );
}
