"use client"; // filter reads (nuqs/searchParams), row-selection state, paged query

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { RowSelectionState } from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { parseAsString, useQueryState } from "nuqs";
import { cn } from "@/lib/utils";
import { DataTable } from "@/components/shared/data-table";
import { Pagination } from "@/components/shared/pagination";
import { useCattleDetail, useCattlePagedList } from "../hooks/use-cattle";
import { buildCattleColumns } from "./cattle-columns";
import { CattleBulkActionsBar } from "./cattle-bulk-actions-bar";
import { CattleFormDialog } from "./cattle-form-dialog";
import { CattleStatusDialog } from "./cattle-status-dialog";
import { CattleArchiveDialog } from "./cattle-archive-dialog";
import { CattleDetailSheet } from "./detail/cattle-detail-sheet";
import type { CattleListFilters, CattleListItem, HealthStatusFilter, ProductionStatus } from "../types";

/** Reads the URL params `CattleFilters` writes (both are siblings under the same page) and drives
 * the cursor-paginated table + bulk-selection toolbar. */
export function CattleTable() {
  const t = useTranslations("cattle");
  const searchParams = useSearchParams();
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [editingId, setEditingId] = useState<string | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<CattleListItem | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<CattleListItem | null>(null);
  /** URL-synced (`?view=`) rather than local state — the drawer is the *only* cattle detail view
   * now (no standalone `/cattle/:id` page), so its own deep link has to live here for the redirect
   * in `app/(app)/cattle/[id]/page.tsx` to have somewhere to land. */
  const [viewId, setViewId] = useQueryState("view", parseAsString);

  const filters: CattleListFilters = {
    search: searchParams.get("search") ?? undefined,
    breedId: searchParams.get("breedId") ?? undefined,
    shedId: searchParams.get("shedId") ?? undefined,
    feedGroupId: searchParams.get("feedGroupId") ?? undefined,
    productionStatus: (searchParams.get("productionStatus") as ProductionStatus | null) ?? undefined,
    healthStatus: (searchParams.get("healthStatus") as HealthStatusFilter | null) ?? undefined,
  };

  const query = useCattlePagedList(filters);
  const editingDetail = useCattleDetail(editingId);
  const items = query.items;
  const columns = useMemo(
    () =>
      buildCattleColumns(t, {
        onView: (cattle) => void setViewId(cattle.id),
        onEdit: (cattle) => {
          setEditingId(cattle.id);
          setFormOpen(true);
        },
        onChangeStatus: setStatusTarget,
        onArchive: setArchiveTarget,
      }),
    [t, setViewId],
  );

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id]);
  const selectedItems = items.filter((c) => selectedIds.includes(c.id));

  return (
    <div className="flex flex-col gap-3">
      <CattleBulkActionsBar
        selectedIds={selectedIds}
        selectedItems={selectedItems}
        onDone={() => setRowSelection({})}
      />
      <div
        className={cn(
          "overflow-hidden rounded-2xl border border-border",
          // Figma "Cattle" table spec, scoped to this instance only (not the shared `Table`
          // primitive, which every other page's table also uses): 54px normal-case header row,
          // 56px body rows (achieved by trimming `TableCell`'s default py-3 to py-2).
          "[&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted",
          "[&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground",
          "[&_tbody_td]:py-2",
        )}
      >
        <DataTable
          columns={columns}
          data={items}
          getRowId={(row) => row.id}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => query.refetch()}
          emptyState={{ title: t("empty.title"), description: t("empty.description") }}
          enableRowSelection
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      </div>
      <Pagination
        page={query.page}
        totalPages={query.totalPages}
        onPageChange={(page) => {
          query.goToPage(page);
          setRowSelection({});
        }}
        disabled={query.isFetching}
      />

      <CattleDetailSheet
        cattleId={viewId ?? undefined}
        onOpenChange={(open) => !open && void setViewId(null)}
        onEdit={(cattle) => {
          void setViewId(null);
          setEditingId(cattle.id);
          setFormOpen(true);
        }}
      />
      <CattleFormDialog
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditingId(undefined);
        }}
        cattle={editingDetail.data}
      />
      <CattleStatusDialog
        open={statusTarget !== null}
        onOpenChange={(open) => !open && setStatusTarget(null)}
        cattle={statusTarget}
      />
      <CattleArchiveDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        cattle={archiveTarget}
      />
    </div>
  );
}
