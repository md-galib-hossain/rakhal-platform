import { Skeleton } from "../ui/skeleton";
import { TableCell, TableRow } from "../ui/table";

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

/** Loading-state rows for DataTable/plain tables while the first page fetches. */
export function TableSkeleton({ rows = 6, columns = 5 }: TableSkeletonProps) {
  return (
    <>
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <TableRow key={rowIndex}>
          {Array.from({ length: columns }).map((_, colIndex) => (
            <TableCell key={colIndex}>
              <Skeleton className="h-4 w-full max-w-32" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  );
}
