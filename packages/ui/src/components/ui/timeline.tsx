import type { ReactNode } from "react";
import { cn } from "../../lib/utils";

export interface TimelineItem {
  id: string;
  icon: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  date: ReactNode;
  /** Optional control under the row (e.g. a "Void" button) — purely presentational, the caller owns what it does. */
  action?: ReactNode;
  /** Dot/icon color — "muted" for a closed/past-only marker with no semantic weight. */
  tone?: "primary" | "success" | "warning" | "info" | "muted";
}

const TONE_DOT: Record<NonNullable<TimelineItem["tone"]>, string> = {
  primary: "border-primary bg-primary/15 text-primary",
  success: "border-accent-teal bg-accent-teal/15 text-accent-teal",
  warning: "border-warning bg-warning/15 text-warning",
  info: "border-info bg-info/15 text-info",
  muted: "border-border bg-muted text-muted-foreground",
};

/** Vertical chronological event timeline — dot-and-connecting-line, one row per event (icon, title,
 * subtitle, date), image-inspired reference from the reproduction-timeline request. Generic/reusable:
 * takes plain `TimelineItem[]`, no domain knowledge of what the events are. */
export function Timeline({ items, className }: { items: TimelineItem[]; className?: string }) {
  return (
    <ol className={cn("flex flex-col", className)}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        return (
          <li key={item.id} className="relative flex gap-3 pb-6 last:pb-0">
            {!isLast ? <span className="absolute left-4 top-8 bottom-0 w-px bg-border" aria-hidden /> : null}
            <span
              className={cn(
                "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border-2",
                TONE_DOT[item.tone ?? "primary"],
              )}
              aria-hidden
            >
              {item.icon}
            </span>
            <div className="flex flex-1 flex-col gap-0.5 pt-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="text-sm font-semibold text-foreground">{item.title}</span>
                <span className="text-xs text-muted-foreground">{item.date}</span>
              </div>
              {item.subtitle ? <span className="text-xs text-muted-foreground">{item.subtitle}</span> : null}
              {item.action ? <div className="pt-1">{item.action}</div> : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
