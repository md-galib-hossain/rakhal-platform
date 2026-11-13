"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@rakhal/ui/ui/tooltip";
import type { FeedPlanLine } from "../../plans-types";

export const PROPORTION_COLORS = [
  "bg-primary",
  "bg-warning",
  "bg-accent-indigo",
  "bg-accent-teal",
  "bg-accent-purple",
  "bg-accent-pink",
  "bg-info",
] as const;

export interface PlanProportionBarProps {
  lines: FeedPlanLine[];
  totalKg: number;
  showLegend?: boolean;
  className?: string;
}

const MAX_VISIBLE_LEGEND = 3;

/**
 * Multi-segment horizontal stacked progress bar representing ingredient ration composition.
 * Calculates percentage (line.kg_per_day / totalKg) * 100 with semantic Rakhal design tokens.
 */
export function PlanProportionBar({
  lines,
  totalKg,
  showLegend = true,
  className,
}: PlanProportionBarProps) {
  const t = useTranslations("feed.plans.card");

  const validTotal = totalKg > 0 ? totalKg : lines.reduce((acc, l) => acc + (l.kg_per_day || 0), 0);
  const visibleLines = lines.filter((l) => (l.kg_per_day ?? 0) > 0);

  const segments = visibleLines.map((line, idx) => {
    const kg = line.kg_per_day ?? 0;
    const pct = validTotal > 0 ? (kg / validTotal) * 100 : 0;
    const color = PROPORTION_COLORS[idx % PROPORTION_COLORS.length];
    return {
      line,
      kg,
      pct,
      color,
      name: line.name || "—",
    };
  });

  const hiddenCount = Math.max(0, segments.length - MAX_VISIBLE_LEGEND);

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Stacked multi-segment bar */}
      <TooltipProvider delayDuration={100}>
        <div
          role="progressbar"
          aria-label={t("compositionTitle")}
          aria-valuemin={0}
          aria-valuemax={validTotal}
          aria-valuenow={validTotal}
          className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted/60"
        >
          {segments.length === 0 ? (
            <div className="h-full w-full bg-muted" />
          ) : (
            segments.map((seg, idx) => {
              const label = `${seg.name}: ${seg.kg.toFixed(1)} kg (${seg.pct.toFixed(1)}%)`;
              return (
                <Tooltip key={seg.line.id || `seg-${idx}`}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      tabIndex={0}
                      style={{ width: `${seg.pct}%` }}
                      className={cn(
                        "h-full shrink-0 border-0 p-0 transition-all duration-300 first:rounded-l-full last:rounded-r-full hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 cursor-default",
                        seg.color,
                      )}
                      aria-label={label}
                    />
                  </TooltipTrigger>
                  <TooltipContent side="top" className="text-xs font-medium">
                    <p>{label}</p>
                  </TooltipContent>
                </Tooltip>
              );
            })
          )}
        </div>
      </TooltipProvider>

      {/* Compact Legend Breakdown */}
      {showLegend && segments.length > 0 && (
        <div className="flex flex-col gap-1 text-xs">
          {segments.slice(0, MAX_VISIBLE_LEGEND).map((seg) => (
            <div key={seg.line.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className={cn("size-2 shrink-0 rounded-full", seg.color)} aria-hidden />
                <span className="truncate text-foreground" title={seg.name}>
                  {seg.name}
                </span>
              </div>
              <span className="shrink-0 tabular-nums text-muted-foreground">
                {seg.kg.toFixed(1)} kg ({seg.pct.toFixed(1)}%)
              </span>
            </div>
          ))}

          {hiddenCount > 0 && (
            <p className="text-[11px] font-medium text-muted-foreground">
              {t("moreIngredients", { count: hiddenCount })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
