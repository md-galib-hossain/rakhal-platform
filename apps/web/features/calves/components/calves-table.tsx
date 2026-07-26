"use client"; // filter reads (URL params), viewId (?view=), paged query

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { useCalvesPagedList } from "../hooks/use-calves";
import { buildCalfColumns } from "./calves-columns";
import { CalfDetailSheet } from "./detail/calf-detail-sheet";
import type { CalfHealthStatus, CalfListFilters, CalfStage } from "../types";

/** Reads the URL params `CalvesFilters` writes (siblings under the same page) and drives the
 * cursor-paginated table. No bulk-select dock (no bulk-ops route exists for calves) and no
 * row-actions column — clicking a calf opens the detail sheet, the only place its 5 log actions
 * (+ wean) live. Mirrors `CattleTable`'s "table owns `viewId`" shape (RFE-033, no Figma frame). */
export function CalvesTable() {
  const t = useTranslations("calves");
  const searchParams = useSearchParams();
  const [viewId, setViewId] = useQueryState("view", parseAsString);

  const filters: CalfListFilters = {
    search: searchParams.get("search") ?? undefined,
    stage: (searchParams.get("stage") as CalfStage | null) ?? undefined,
    healthStatus: (searchParams.get("healthStatus") as CalfHealthStatus | null) ?? undefined,
  };

  const query = useCalvesPagedList(filters);
  const items = query.items;
  const columns = useMemo(
    () => buildCalfColumns(t, { onView: (calf) => void setViewId(calf.id) }),
    [t, setViewId],
  );

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("overflow-hidden rounded-2xl border border-border", "[&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted")}>
        <DataTable
          columns={columns}
          data={items}
          getRowId={(row) => row.id}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => query.refetch()}
          emptyState={{ title: t("empty.title"), description: t("empty.description") }}
        />
      </div>
      <Pagination
        page={query.page}
        totalPages={query.totalPages}
        onPageChange={(page) => query.goToPage(page)}
        isFetching={query.isFetching}
        pageSize={query.pageSize}
        onPageSizeChange={(size) => query.setPageSize(size)}
      />

      <CalfDetailSheet calfId={viewId ?? undefined} onOpenChange={(open) => !open && void setViewId(null)} />
    </div>
  );
}
