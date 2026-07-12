import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ChartCardProps {
  title: string;
  /** Small muted caption under the title (e.g. "Monthly tracking 2026"). */
  subtitle?: string;
  /** Range picker / period selector slot, rendered in the header. */
  rangeControl?: React.ReactNode;
  /** Export button/menu slot, rendered in the header. */
  exportControl?: React.ReactNode;
  /** Legend swatches, rendered top-right of the header (Figma chart-card legend row). */
  legend?: React.ReactNode;
  /** The chart itself — pass a `next/dynamic`-imported recharts component to keep it out of the main bundle. */
  children: React.ReactNode;
  className?: string;
}

/** Dashboard/report card wrapping a dynamically-imported chart with a consistent header — 16px
 * padding all round (Figma chart-card spec), not the `Card` primitive's default 24px, so the plot
 * doesn't float in a sea of whitespace. */
export function ChartCard({ title, subtitle, rangeControl, exportControl, legend, children, className }: ChartCardProps) {
  return (
    <Card className={cn("rounded-2xl", className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4 pb-3">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">{title}</CardTitle>
          {subtitle ? <p className="text-xs text-muted-foreground">{subtitle}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {legend}
          {rangeControl}
          {exportControl}
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">{children}</CardContent>
    </Card>
  );
}
