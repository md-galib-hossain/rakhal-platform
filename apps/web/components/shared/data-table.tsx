"use client"; // TanStack Table + URL-synced sort via nuqs, cursor "load more" pagination

import { useMemo } from "react";
import {
  type ColumnDef,
  type OnChangeFn,
  type RowSelectionState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { parseAsString, useQueryState } from "nuqs";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";

export interface DataTableEmptyState {
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export interface DataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[];
  data: TData[];
  getRowId?: (row: TData) => string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyState?: DataTableEmptyState;
  /** Cursor pagination — DataTable renders a "Load more" button, the caller owns the actual fetch. */
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
  onLoadMore?: () => void;
  /** URL param key for single-column sort, serialized as `field.asc` / `field.desc`. Omit to disable. */
  sortParamKey?: string;
  enableRowSelection?: boolean;
  rowSelection?: RowSelectionState;
  onRowSelectionChange?: OnChangeFn<RowSelectionState>;
  /** Card renderer shown below `sm` instead of the table (mobile card-collapse). Omit to always render the table. */
  renderMobileCard?: (row: TData) => React.ReactNode;
  className?: string;
}

/**
 * Shared TanStack-Table wrapper: cursor "load more" pagination (caller fetches, this renders the
 * button), URL-synced single-column sort, row selection for bulk ops, and all four view states.
 * Sorting/pagination are server-driven (backend cursor keyset) — this component never re-sorts or
 * re-slices `data` client-side.
 */
export function DataTable<TData>({
  columns,
  data,
  getRowId,
  isLoading = false,
  isError = false,
  onRetry,
  emptyState,
  hasNextPage = false,
  isFetchingNextPage = false,
  onLoadMore,
  sortParamKey,
  enableRowSelection = false,
  rowSelection,
  onRowSelectionChange,
  renderMobileCard,
  className,
}: DataTableProps<TData>) {
  const [sort, setSort] = useQueryState(sortParamKey ?? "__sort_unused__", parseAsString);

  const tableColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    if (!enableRowSelection) return columns;
    const selectColumn: ColumnDef<TData, unknown> = {
      id: "__select__",
      size: 40,
      header: ({ table }) => (
        <Checkbox
          checked={table.getIsAllRowsSelected() ? true : table.getIsSomeRowsSelected() ? "indeterminate" : false}
          onCheckedChange={(checked) => table.toggleAllRowsSelected(checked === true)}
          aria-label="Select all rows"
        />
      ),
      cell: ({ row }) => (
        <Checkbox
          checked={row.getIsSelected()}
          onCheckedChange={(checked) => row.toggleSelected(checked === true)}
          aria-label="Select row"
        />
      ),
    };
    return [selectColumn, ...columns];
  }, [columns, enableRowSelection]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
    enableRowSelection,
    state: enableRowSelection ? { rowSelection } : undefined,
    onRowSelectionChange,
  });

  if (isError) {
    return <ErrorState onRetry={onRetry} className={className} />;
  }

  if (!isLoading && data.length === 0) {
    return <EmptyState title={emptyState?.title ?? "No results found"} description={emptyState?.description} action={emptyState?.action} className={className} />;
  }

  const [sortField, sortDir] = sort ? sort.split(".") : [undefined, undefined];

  function toggleSort(field: string) {
    if (!sortParamKey) return;
    if (sortField !== field) void setSort(`${field}.asc`);
    else if (sortDir === "asc") void setSort(`${field}.desc`);
    else void setSort(null);
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className={cn(renderMobileCard && "hidden sm:block")}>
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const sortField2 = header.column.columnDef.meta as { sortField?: string } | undefined;
                  const field = sortField2?.sortField;
                  return (
                    <TableHead
                      key={header.id}
                      className={field ? "cursor-pointer select-none" : undefined}
                      onClick={field ? () => toggleSort(field) : undefined}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                      {field && sortField === field ? (sortDir === "asc" ? " ▲" : " ▼") : null}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && data.length === 0 ? (
              <TableSkeleton columns={tableColumns.length} />
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() ? "selected" : undefined}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {renderMobileCard ? (
        <div className="flex flex-col gap-3 sm:hidden">
          {table.getRowModel().rows.map((row) => (
            <div key={row.id}>{renderMobileCard(row.original)}</div>
          ))}
        </div>
      ) : null}

      {hasNextPage ? (
        <div className="flex justify-center">
          <Button variant="outline" onClick={onLoadMore} disabled={isFetchingNextPage}>
            {isFetchingNextPage ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
