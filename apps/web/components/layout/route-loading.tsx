import { Skeleton } from "@rakhal/ui/ui/skeleton";
import { CardSkeleton } from "@rakhal/ui/shared/card-skeleton";

/** Generic per-segment `loading.tsx` body — swapped for a bespoke skeleton as each page is built. */
export function RouteLoading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    </div>
  );
}
