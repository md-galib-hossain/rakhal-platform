import { Box, TrendingDown, TrendingUp } from "lucide-react";
import { cn } from "../../lib/utils";
import { Card } from "../ui/card";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Signed percentage or count change shown next to a trend arrow. */
  delta?: number;
  deltaLabel?: string;
  icon?: React.ReactNode;
  /** Overrides the icon chip's tint/color pair (default `bg-info-tint text-info`) — e.g. forage's
   * detail-sheet KPI row uses a distinct color per tile (Figma "Item Details - Forage", 732:13304). */
  iconClassName?: string;
  /** Tiny inline trend chart (e.g. `<Sparkline />`) rendered under the value. */
  sparkline?: React.ReactNode;
  className?: string;
}

/** Dashboard KPI / module highlight-bar tile — Figma "KPI" component (cattle detail sheet, node
 * 1042:58073): a small colored icon chip over a label, a large value, and a pill-shaped trend chip
 * (tinted bg, arrow + signed delta) next to a "vs last period" caption. */
export function StatCard({ label, value, delta, deltaLabel, icon, iconClassName, sparkline, className }: StatCardProps) {
  const isPositive = typeof delta === "number" && delta > 0;
  const isNegative = typeof delta === "number" && delta < 0;

  return (
    <Card className={cn("flex flex-col justify-between gap-3 rounded-xl p-3", className)}>
      <div className="flex items-center gap-2">
        <span className={cn("flex size-7 shrink-0 items-center justify-center rounded-lg shadow-sm", iconClassName ?? "bg-info-tint text-info")}>
          {icon ?? <Box className="size-4" aria-hidden />}
        </span>
        <p className="text-sm font-medium text-foreground">{label}</p>
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-2xl font-bold text-foreground">{value}</p>
        {typeof delta === "number" ? (
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "flex items-center gap-1 rounded-full py-1 pl-1 pr-1.5 text-xs font-bold",
                isPositive && "bg-success-tint text-success",
                isNegative && "bg-destructive-tint text-destructive",
                !isPositive && !isNegative && "bg-muted text-muted-foreground",
              )}
            >
              {isPositive ? (
                <TrendingUp className="size-3.5" aria-hidden />
              ) : isNegative ? (
                <TrendingDown className="size-3.5" aria-hidden />
              ) : null}
              {Math.abs(delta) > 999 ? "999+" : Math.abs(delta)}
              {deltaLabel ? ` ${deltaLabel}` : null}
            </span>
          </div>
        ) : null}
      </div>
      {sparkline}
    </Card>
  );
}
