"use client"; // filter reads (nuqs/searchParams), view toggle state, paged query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useArchiveFeedItem, useFeedItemPagedList } from "../hooks/use-inventory";
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
  const searchParams = useSearchParams();
  const [viewingId, setViewingId] = useState<string | undefined>(undefined);
  const [editingFeedItem, setEditingFeedItem] = useState<FeedItem | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<FeedItem | null>(null);
  const archiveFeedItem = useArchiveFeedItem();

  const filters = {
    search: searchParams.get("search") ?? undefined,
    feedClass: (searchParams.get("feedClass") as FeedClass | null) ?? undefined,
  };

  const query = useFeedItemPagedList(filters);

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    try {
      await archiveFeedItem.mutateAsync(archiveTarget.id);
      toast.success(t("archivedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
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
        />
      )}

      <Pagination page={query.page} totalPages={query.totalPages} onPageChange={query.goToPage} disabled={query.isFetching} />

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
    </div>
  );
}
