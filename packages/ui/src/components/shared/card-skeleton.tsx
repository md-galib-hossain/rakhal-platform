import { cn } from "../../lib/utils";
import { Card, CardContent, CardHeader } from "../ui/card";
import { Skeleton } from "../ui/skeleton";

export interface CardSkeletonProps {
  className?: string;
  /** Number of body lines to render under the header skeleton. */
  lines?: number;
}

/** Loading-state placeholder for StatCard/ChartCard/dashboard widgets. */
export function CardSkeleton({ className, lines = 2 }: CardSkeletonProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {Array.from({ length: lines }).map((_, index) => (
          <Skeleton key={index} className="h-4 w-full" />
        ))}
      </CardContent>
    </Card>
  );
}
