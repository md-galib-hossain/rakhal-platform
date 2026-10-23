import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

/** Above this many days a one-segment-per-day track gets too thin to read, so it falls back to a
 * continuous bar. Synchronisation protocols (Ovsynch / CIDR / PGF2α) are 7–14 days, well under it. */
const MAX_SEGMENTS = 21;

/** Where a cow is inside a protocol: one segment per day (filled = done, ringed = today), a bold
 * "Day 4 of 10" on the left and what is left on the right. The track has a bounded width so the label
 * and the bar stay visually tied — the old bar stretched across the whole row, hundreds of pixels from
 * its own label. `day` is 0 for a protocol that has not started yet. */
export function ProtocolProgress({
  day,
  total,
  aiDone = false,
  hideSummary = false,
  className,
}: {
  day: number;
  total: number;
  aiDone?: boolean;
  /** Drops the "Day x of y / n left" line when the caller already says it (a not-yet-started protocol). */
  hideSummary?: boolean;
  className?: string;
}) {
  const t = useTranslations("reproduction.protocols");
  const label = t("dayOf", { day, total });
  const left = total - day;
  const finalDay = day >= total;
  const segmented = total <= MAX_SEGMENTS;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {hideSummary ? null : (
        <div className="flex items-baseline justify-between gap-3 text-xs">
          <span className="font-semibold tabular-nums text-foreground">{label}</span>
          <span className={cn("tabular-nums", finalDay ? "font-semibold text-primary" : "text-muted-foreground")}>
            {finalDay ? t("lastDay") : t("daysLeft", { count: left })}
          </span>
        </div>
      )}

      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={day}
        className="flex h-2 gap-[3px]"
      >
        {segmented ? (
          Array.from({ length: total }, (_, i) => {
            const n = i + 1;
            return (
              <span
                key={n}
                className={cn(
                  "h-full min-w-0 flex-1 rounded-full transition-colors",
                  n <= day ? "bg-primary" : "bg-muted",
                  n === day && "ring-2 ring-primary/25 ring-offset-1 ring-offset-card",
                )}
              />
            );
          })
        ) : (
          <span className="relative h-full flex-1 overflow-hidden rounded-full bg-muted">
            <span className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${(day / total) * 100}%` }} />
          </span>
        )}
      </div>

      {aiDone ? <span className="text-xs font-medium text-accent-teal">{t("aiDone")}</span> : null}
    </div>
  );
}
