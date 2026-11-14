"use client"; // filter reads (nuqs/searchParams), view toggle state, paged query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import type { RowSelectionState } from "@tanstack/react-table";
import { ApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { ConfirmDialog } from "@rakhal/ui/shared/confirm-dialog";
import { BulkActionDock } from "@/components/shared/bulk-action-dock";
import { useTableBulkSelection, useGridBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { useArchiveMedicine, useBulkDeleteMedicines, useMedicineInfiniteList } from "../hooks/use-inventory";
import { MedicineFilters } from "./medicine-filters";
import { MedicineAddButton } from "./medicine-add-button";
import { MedicineTable } from "./medicine-table";
import { MedicineGrid } from "./medicine-grid";
import { MedicineFormDialog } from "./medicine-form-dialog";
import type { Medicine, MedicineCategory, MedicineListStatus } from "../types";

/** Medicine tab body — search/filter row, table/grid view (view state owned by the parent
 * `InventoryTabs`), pagination, and the add/edit/archive flows. Same shape as `CattleTable`. */
export function MedicineView({ view }: { view: "table" | "grid" }) {
  const t = useTranslations("inventory.medicine");
  const can = useCan();
  const canDelete = can("inventory.delete");
  const searchParams = useSearchParams();
  const [editingMedicine, setEditingMedicine] = useState<Medicine | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Medicine | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const archiveMedicine = useArchiveMedicine();
  const bulkDeleteMedicines = useBulkDeleteMedicines();

  const filters = {
    search: searchParams.get("search") ?? undefined,
    category: (searchParams.get("category") as MedicineCategory | null) ?? undefined,
    status: (searchParams.get("status") as MedicineListStatus | null) ?? undefined,
  };

  const query = useMedicineInfiniteList(filters);
  const allIds = query.items.map((m) => m.id);
  const tableSelection = useTableBulkSelection(rowSelection, setRowSelection, allIds);
  const gridSelection = useGridBulkSelection(allIds);
  const selection = view === "table" ? tableSelection : gridSelection;

  // Filters swap the underlying item set entirely — stale ids should never linger selected. Reset
  // during render (React's blessed "adjusting state when a prop changes" pattern, same technique
  // `useMedicinePagedList` itself already uses for its own filters-changed reset) rather than an
  // effect, since a `setState` inside `useEffect` trips this repo's `react-hooks/set-state-in-effect` gate.
  const filtersKey = JSON.stringify(filters);
  const [prevFiltersKey, setPrevFiltersKey] = useState(filtersKey);
  if (filtersKey !== prevFiltersKey) {
    setPrevFiltersKey(filtersKey);
    setRowSelection({});
    gridSelection.clear();
  }

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    try {
      await archiveMedicine.mutateAsync(archiveTarget.id);
      toast.success(t("archivedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handleBulkDelete(ids: string[]) {
    try {
      const result = await bulkDeleteMedicines.mutateAsync(ids);
      toast.success(t("bulk.deletedToast", { count: result.deleted }));
      selection.clear();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("bulk.genericError"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <MedicineFilters
        actions={
          <MedicineAddButton
            onClick={() => {
              setEditingMedicine(undefined);
              setFormOpen(true);
            }}
          />
        }
      />

      {view === "table" ? (
        <MedicineTable
          items={query.items}
          startIndex={0}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onEdit={(medicine) => {
            setEditingMedicine(medicine);
            setFormOpen(true);
          }}
          onArchive={setArchiveTarget}
          enableRowSelection={canDelete}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      ) : (
        <MedicineGrid
          items={query.items}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onEdit={(medicine) => {
            setEditingMedicine(medicine);
            setFormOpen(true);
          }}
          onArchive={setArchiveTarget}
          canSelect={canDelete}
          isSelected={gridSelection.isSelected}
          onToggleSelect={gridSelection.toggle}
        />
      )}

      {!query.isLoading && !query.isError && query.items.length > 0 ? (
        <InfiniteScrollFooter
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          isError={query.isNextPageError}
          onLoadMore={query.fetchNextPage}
          loadedCount={query.items.length}
        />
      ) : null}

      <MedicineFormDialog open={formOpen} onOpenChange={setFormOpen} medicine={editingMedicine} />
      <ConfirmDialog
        open={archiveTarget !== null}
        onOpenChange={(open) => !open && setArchiveTarget(null)}
        title={t("archiveDialog.title", { name: archiveTarget?.name ?? "" })}
        description={t("archiveDialog.description")}
        confirmLabel={t("archiveDialog.confirm")}
        cancelLabel={t("archiveDialog.cancel")}
        onConfirm={handleArchiveConfirm}
      />

      <BulkActionDock
        selectedCount={selection.selectedCount}
        totalCount={allIds.length}
        onSelectAll={selection.toggleAll}
        onCancel={selection.clear}
        selectedIds={selection.selectedIds}
        selectAllLabel={t("bulk.selectAll", { count: allIds.length })}
        cancelLabel={t("bulk.cancel")}
        selectedCountLabel={t("bulk.selectedCount", { count: selection.selectedCount })}
        actions={[
          {
            key: "delete",
            label: t("bulk.deleteSelected"),
            variant: "destructive",
            requiresConfirm: true,
            confirmTitle: t("bulk.deleteDialog.title"),
            confirmDescription: t("bulk.deleteDialog.description", { count: selection.selectedCount }),
            confirmLabel: t("bulk.deleteDialog.confirm"),
            onRun: handleBulkDelete,
          },
        ]}
      />
    </div>
  );
}
