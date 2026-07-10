import { ArrowDown, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  /** Signed percentage or count change shown next to a trend arrow. */
  delta?: number;
  deltaLabel?: string;
  icon?: React.ReactNode;
  /** Tiny inline trend chart (e.g. `<Sparkline />`) rendered under the value. */
  sparkline?: React.ReactNode;
  className?: string;
}

/** Dashboard KPI / module highlight-bar tile. */
export function StatCard({ label, value, delta, deltaLabel, icon, sparkline, className }: StatCardProps) {
  const isPositive = typeof delta === "number" && delta > 0;
  const isNegative = typeof delta === "number" && delta < 0;

  return (
    <Card className={cn("flex flex-col gap-2 p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
      </div>
      <p className="text-2xl font-semibold text-foreground">{value}</p>
      {typeof delta === "number" ? (
        <p
          className={cn(
            "flex items-center gap-1 text-xs font-medium",
            isPositive && "text-success",
            isNegative && "text-destructive",
            !isPositive && !isNegative && "text-muted-foreground",
          )}
        >
          {isPositive ? <ArrowUp className="size-3.5" /> : isNegative ? <ArrowDown className="size-3.5" /> : null}
          {Math.abs(delta)}
          {deltaLabel ? ` ${deltaLabel}` : null}
        </p>
      ) : null}
      {sparkline}
    </Card>
  );
}
