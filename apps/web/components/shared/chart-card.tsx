import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ChartCardProps {
  title: string;
  /** Range picker / period selector slot, rendered in the header. */
  rangeControl?: React.ReactNode;
  /** Export button/menu slot, rendered in the header. */
  exportControl?: React.ReactNode;
  /** The chart itself — pass a `next/dynamic`-imported recharts component to keep it out of the main bundle. */
  children: React.ReactNode;
  className?: string;
}

/** Dashboard/report card wrapping a dynamically-imported chart with a consistent header. */
export function ChartCard({ title, rangeControl, exportControl, children, className }: ChartCardProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>{title}</CardTitle>
        <div className="flex items-center gap-2">
          {rangeControl}
          {exportControl}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
