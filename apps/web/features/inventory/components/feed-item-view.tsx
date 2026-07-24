"use client"; // filter reads (nuqs/searchParams), view toggle state, paged query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import type { RowSelectionState } from "@tanstack/react-table";
import { ApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { BulkActionDock } from "@/components/shared/bulk-action-dock";
import { useTableBulkSelection, useGridBulkSelection } from "@/lib/hooks/use-bulk-selection";
import { useArchiveFeedItem, useBulkDeleteFeedItems, useFeedItemPagedList } from "../hooks/use-inventory";
import { FeedItemFilters } from "./feed-item-filters";
import { FeedItemAddButton } from "./feed-item-add-button";
import { FeedItemTable } from "./feed-item-table";
import { FeedItemGrid } from "./feed-item-grid";
import { FeedItemFormDialog } from "./feed-item-form-dialog";
import { FeedItemDetailSheet } from "./feed-item-detail-sheet";
import type { FeedClass, FeedItem } from "../types";

/** Feed tab's "Purchased" view body — search/filter row, table/grid view (view state owned by the
 * parent `InventoryTabs`), pagination, and the view/add/edit/archive flows. Same shape as
 * `MedicineView`, plus a "View Details" sheet Medicine doesn't have yet (Figma gave this one a
 * dedicated one). */
export function FeedItemView({ view }: { view: "table" | "grid" }) {
  const t = useTranslations("inventory.feed");
  const can = useCan();
  const canDelete = can("inventory.delete");
  const searchParams = useSearchParams();
  const [viewingId, setViewingId] = useState<string | undefined>(undefined);
  const [editingFeedItem, setEditingFeedItem] = useState<FeedItem | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<FeedItem | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const archiveFeedItem = useArchiveFeedItem();
  const bulkDeleteFeedItems = useBulkDeleteFeedItems();

  const filters = {
    search: searchParams.get("search") ?? undefined,
    feedClass: (searchParams.get("feedClass") as FeedClass | null) ?? undefined,
  };

  const query = useFeedItemPagedList(filters);
  const allIds = query.items.map((f) => f.id);
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
      await archiveFeedItem.mutateAsync(archiveTarget.id);
      toast.success(t("archivedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  async function handleBulkDelete(ids: string[]) {
    try {
      const result = await bulkDeleteFeedItems.mutateAsync(ids);
      toast.success(t("bulk.deletedToast", { count: result.deleted }));
      selection.clear();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("bulk.genericError"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <FeedItemFilters
        actions={
          <FeedItemAddButton
            onClick={() => {
              setEditingFeedItem(undefined);
              setFormOpen(true);
            }}
          />
        }
      />

      {view === "table" ? (
        <FeedItemTable
          items={query.items}
          startIndex={(query.page - 1) * 20}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onView={(feedItem) => setViewingId(feedItem.id)}
          onEdit={(feedItem) => {
            setEditingFeedItem(feedItem);
            setFormOpen(true);
          }}
          onArchive={setArchiveTarget}
          enableRowSelection={canDelete}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      ) : (
        <FeedItemGrid
          items={query.items}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onView={(feedItem) => setViewingId(feedItem.id)}
          onEdit={(feedItem) => {
            setEditingFeedItem(feedItem);
            setFormOpen(true);
          }}
          onArchive={setArchiveTarget}
          canSelect={canDelete}
          isSelected={gridSelection.isSelected}
          onToggleSelect={gridSelection.toggle}
        />
      )}

      <Pagination
        page={query.page}
        totalPages={query.totalPages}
        onPageChange={(page) => {
          query.goToPage(page);
          setRowSelection({});
        }}
        isFetching={query.isFetching}
        pageSize={query.pageSize}
        onPageSizeChange={(size) => {
          query.setPageSize(size);
          setRowSelection({});
        }}
      />

      <FeedItemFormDialog open={formOpen} onOpenChange={setFormOpen} feedItem={editingFeedItem} />
      <FeedItemDetailSheet
        feedItemId={viewingId}
        onOpenChange={(open) => !open && setViewingId(undefined)}
        onEdit={(feedItem) => {
          setViewingId(undefined);
          setEditingFeedItem(feedItem);
          setFormOpen(true);
        }}
      />
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
