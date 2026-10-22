"use client"; // owns the infinite-query state for a list

import { useInfiniteQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { MobileRecordCard, type MobileRecordField } from "@rakhal/ui/shared/mobile-record-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@rakhal/ui/ui/table";
import { getJson } from "@/lib/api/browser";
import type { Page } from "@/lib/api/directory";
import { InfiniteFooter } from "./infinite-footer";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  className?: string;
}

export interface MobileCard {
  title: ReactNode;
  subtitle?: ReactNode;
  badges?: ReactNode;
  fields?: MobileRecordField[];
}

/**
 * Infinite table (cards below `md`). The server renders the first page into `initial`, so there is no
 * client fetch on mount; further pages come from `/api/directory/<resource>` as the user scrolls.
 * Callers remount it (via `key`) when the search changes, which restarts from the new first page.
 */
export function InfiniteDirectory<T extends { id: string }>({
  resource,
  params,
  initial,
  caption,
  columns,
  mobile,
}: {
  resource: "farms" | "users" | "audit";
  params: Record<string, string | undefined>;
  initial: Page<T>;
  caption: string;
  columns: Column<T>[];
  mobile: (row: T) => MobileCard;
}) {
  const query = useInfiniteQuery({
    queryKey: ["directory", resource, params],
    initialPageParam: undefined as string | undefined,
    initialData: { pages: [initial], pageParams: [undefined] },
    staleTime: 60_000,
    queryFn: async ({ pageParam }) => {
      const sp = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
      if (pageParam) sp.set("cursor", pageParam);
      return getJson<Page<T>>(`/api/directory/${resource}?${sp.toString()}`);
    },
    getNextPageParam: (last) => (last.meta.hasNextPage && last.meta.endCursor ? last.meta.endCursor : undefined),
  });

  const rows = query.data.pages.flatMap((p) => p.items);

  return (
    <div className="flex flex-col gap-2">
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <Table>
          <caption className="sr-only">{caption}</caption>
          <TableHeader className="bg-muted/40">
            <TableRow className="hover:bg-transparent">
              {columns.map((c) => (
                <TableHead key={c.header} className={c.className}>
                  {c.header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                {columns.map((c) => (
                  <TableCell key={c.header} className={`align-top ${c.className ?? ""}`}>
                    {c.cell(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="flex flex-col gap-2 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li key={row.id}>
            <MobileRecordCard {...mobile(row)} />
          </li>
        ))}
      </ul>

      <InfiniteFooter
        hasNextPage={!!query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        isError={query.isError}
        onLoadMore={() => void query.fetchNextPage()}
        loadedCount={rows.length}
      />
    </div>
  );
}
