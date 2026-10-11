"use client"; // filter reads (nuqs/searchParams), view toggle state, paged query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import type { RowSelectionState } from "@tanstack/react-table";
import { ApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { BulkActionDock } from "@/components/shared/bulk-action-dock";
import { useTableBulkSelection, useGridBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { useArchiveEquipment, useBulkDeleteEquipment, useEquipmentInfiniteList } from "../hooks/use-inventory";
import { EquipmentFilters } from "./equipment-filters";
import { EquipmentAddButton } from "./equipment-add-button";
import { EquipmentTable } from "./equipment-table";
import { EquipmentGrid } from "./equipment-grid";
import { EquipmentFormDialog } from "./equipment-form-dialog";
import type { Equipment, EquipmentType } from "../types";

/** Others/Equipment tab body — search/filter row, table/grid view (view state owned by the parent
 * `InventoryTabs`), pagination, and the add/edit/archive flows. Same shape as `MedicineView`. */
export function EquipmentView({ view }: { view: "table" | "grid" }) {
  const t = useTranslations("inventory.equipment");
  const can = useCan();
  const canDelete = can("inventory.delete");
  const searchParams = useSearchParams();
  const [editingEquipment, setEditingEquipment] = useState<Equipment | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Equipment | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const archiveEquipment = useArchiveEquipment();
  const bulkDeleteEquipment = useBulkDeleteEquipment();

  const filters = {
    search: searchParams.get("search") ?? undefined,
    type: (searchParams.get("type") as EquipmentType | null) ?? undefined,
  };

  const query = useEquipmentInfiniteList(filters);
  const allIds = query.items.map((e) => e.id);
  const tableSelection = useTableBulkSelection(rowSelection, setRowSelection, allIds);
  const gridSelection = useGridBulkSelection(allIds);
  const selection = view === "table" ? tableSelection : gridSelection;

  // Filters swap the underlying item set entirely — reset during render (see `MedicineView`'s
  // matching comment for why this isn't a `useEffect`).
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
      await archiveEquipment.mutateAsync(archiveTarget.id);
      toast.success(t("archivedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handleBulkDelete(ids: string[]) {
    try {
      const result = await bulkDeleteEquipment.mutateAsync(ids);
      toast.success(t("bulk.deletedToast", { count: result.deleted }));
      selection.clear();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("bulk.genericError"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <EquipmentFilters
        actions={
          <EquipmentAddButton
            onClick={() => {
              setEditingEquipment(undefined);
              setFormOpen(true);
            }}
          />
        }
      />

      {view === "table" ? (
        <EquipmentTable
          items={query.items}
          startIndex={0}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onEdit={(equipment) => {
            setEditingEquipment(equipment);
            setFormOpen(true);
          }}
          onArchive={setArchiveTarget}
          enableRowSelection={canDelete}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      ) : (
        <EquipmentGrid
          items={query.items}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onEdit={(equipment) => {
            setEditingEquipment(equipment);
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

      <EquipmentFormDialog open={formOpen} onOpenChange={setFormOpen} equipment={editingEquipment} />
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
