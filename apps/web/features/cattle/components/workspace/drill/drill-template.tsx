import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { WS_CARD } from "../workspace-grid";

/**
 * Shared drill-panel template (RFE-182): the one body every Overview "View" opens (Milk, Growth, Reproduction,
 * Health) and the look the Feeding / Family / Money tab bodies reuse. Pieces:
 *  - `DrillStats`: auto-fit grid of stat tiles (`minmax(140px, 1fr)`), so tiles never squeeze or overflow.
 *  - `DrillStat`: UPPERCASE small label, big number, muted sub-line (the prototype tile).
 *  - `DrillCard`: white card (WS_CARD) with a small uppercase title + action slot; charts and tables sit full width.
 * Pure markup, no hooks, so it works from server or client files.
 */
export function DrillStats({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <dl className={cn("m-0 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3", className)}>{children}</dl>
  );
}

const TONE: Record<"success" | "warning" | "destructive", string> = {
  success: "text-success",
  warning: "text-warning",
  destructive: "text-destructive",
};

export function DrillStat({
  label,
  value,
  hint,
  muted,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  /** Value is absent (a dash): dims it so it does not read like a number. */
  muted?: boolean;
  tone?: keyof typeof TONE;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-2xl border border-border bg-card p-4 shadow-none">
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd
        className={cn(
          "m-0 break-words text-2xl font-semibold tabular-nums",
          muted ? "text-muted-foreground" : tone ? TONE[tone] : "text-foreground",
        )}
      >
        {value}
      </dd>
      {hint ? <dd className="m-0 text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

export function DrillCard({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(WS_CARD, "flex min-w-0 flex-col gap-4", className)}>
      {title || action ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          {title ? (
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</h3>
          ) : (
            <span />
          )}
          {action}
        </div>
      ) : null}
      {children}
    </section>
  );
}

/** Vertical stack for a drill / tab body. */
export function DrillBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex min-w-0 flex-col gap-4", className)}>{children}</div>;
}
