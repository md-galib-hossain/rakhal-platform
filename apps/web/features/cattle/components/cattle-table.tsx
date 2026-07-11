"use client"; // filter reads (nuqs/searchParams), row-selection state, infinite query

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { RowSelectionState } from "@tanstack/react-table";
import { useSearchParams } from "next/navigation";
import { DataTable } from "@/components/shared/data-table";
import { useCattleDetail, useCattleList } from "../hooks/use-cattle";
import { buildCattleColumns } from "./cattle-columns";
import { CattleBulkActionsBar } from "./cattle-bulk-actions-bar";
import { CattleFormDialog } from "./cattle-form-dialog";
import { CattleStatusDialog } from "./cattle-status-dialog";
import { CattleArchiveDialog } from "./cattle-archive-dialog";
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

  const filters: CattleListFilters = {
    search: searchParams.get("search") ?? undefined,
    breedId: searchParams.get("breedId") ?? undefined,
    shedId: searchParams.get("shedId") ?? undefined,
    feedGroupId: searchParams.get("feedGroupId") ?? undefined,
    productionStatus: (searchParams.get("productionStatus") as ProductionStatus | null) ?? undefined,
    healthStatus: (searchParams.get("healthStatus") as HealthStatusFilter | null) ?? undefined,
  };

  const query = useCattleList(filters);
  const editingDetail = useCattleDetail(editingId);
  const items = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const columns = useMemo(
    () =>
      buildCattleColumns(t, {
        onEdit: (cattle) => {
          setEditingId(cattle.id);
          setFormOpen(true);
        },
        onChangeStatus: setStatusTarget,
        onArchive: setArchiveTarget,
      }),
    [t],
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
      <DataTable
        columns={columns}
        data={items}
        getRowId={(row) => row.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        emptyState={{ title: t("empty.title"), description: t("empty.description") }}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
        enableRowSelection
        rowSelection={rowSelection}
        onRowSelectionChange={setRowSelection}
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
