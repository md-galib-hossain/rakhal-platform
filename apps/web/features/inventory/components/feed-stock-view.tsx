"use client"; // live query, joins stock lots against the cached concentrations list for source name+kind

import { useMemo, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Package } from "lucide-react";
import type { RowSelectionState } from "@tanstack/react-table";
import { ApiError } from "@/lib/api/errors";
import { useCan } from "@/lib/auth/permissions";
import { Button } from "@rakhal/ui/ui/button";
import { CardSkeleton } from "@rakhal/ui/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { EmptyState } from "@rakhal/ui/shared/empty-state";
import { ConfirmDialog } from "@rakhal/ui/shared/confirm-dialog";
import { BulkActionDock } from "@/components/shared/bulk-action-dock";
import { useTableBulkSelection, useGridBulkSelection } from "@/lib/hooks/use-bulk-selection";
import {
  useArchiveFeedStock,
  useBulkDeleteFeedStock,
  useConcentrations,
  useFeedStock,
} from "@/features/feed/hooks/use-feed";
import type { FeedStock } from "@/features/feed/types";
import { FeedStockTable } from "./feed-stock-table";
import { FeedStockGrid } from "./feed-stock-grid";
import type { FeedStockSource } from "./feed-stock-columns";

/**
 * Inventory's Feed tab → "Prepared" segment (moved here 2026-07-19 from a standalone section on
 * the Feed Formulator page — user report: "we have already a inventory... no need to create the
 * tmr feed inventory here"; folded into the unified Feed tab's segmented control alongside
 * "Purchased" at `feed_taxonomy_unification`). List of `FeedStock` lots produced by finalizing
 * **either** a Total Mixed Ration or a Concentrate Mixer on the Feed Formulator page; actual stock
 * *decrement* happens through "Feed Today" (`features/feed/components/log-distribution-dialog.tsx`),
 * not here.
 *
 * **Superseded 2026-09-13 (RAKHAL-421, MILESTONE 8c):** the 2026-07-19 stance below this comment
 * used to hold — a Concentrate Mixer was a virtual recipe/calculator that never touched inventory,
 * and only a TMR finalize produced a real `FeedStock` lot. Bought vs made is now the real line
 * (`FeedItem` = purchased, `FeedStock` = prepared), so **both** kinds land here, distinguished by
 * each lot's own `kind` field (see `FeedStockSource`/`buildFeedStockColumns`'s badge, which already
 * read this correctly via the `source_concentration_id` join before this field existed on the lot
 * itself). Full rationale: `docs/EPIC_PREPARED_FEED.md`, ADR-025.
 *
 * **Table/grid parity + metrics (user follow-up, 2026-07-19)**: previously a bespoke flat
 * divide-y list with 3 stats (produced/remaining/cost) — user asked for the same shared
 * table/grid the rest of Inventory uses, plus deeper metrics (total cost, per-kg cost, consumed
 * quantity). Now delegates to `FeedStockTable`/`FeedStockGrid` (same `view` toggle contract as
 * `FeedItemView`/Purchased) with a source name+kind lookup built from the already-cached
 * `useConcentrations()` list (no backend join needed).
 *
 * **Deletable (user follow-up, 2026-07-19 — "form inventory it can be also deleted")**: a lot can
 * be removed from inventory here, same soft-delete-with-confirm pattern as the Purchased tab's
 * archive flow. **Bulk-select (2026-07-21)**: multi-select + the shared floating `BulkActionDock`
 * now also cover this segment, gated on `feed.delete` (Feed Stock's own permission namespace, not
 * `inventory.delete` — see `feed.controller.ts`).
 */
export function FeedStockView({ view }: { view: "table" | "grid" }) {
  const t = useTranslations("feed.stock");
  const can = useCan();
  const canDelete = can("feed.delete");
  const stock = useFeedStock();
  const concentrations = useConcentrations();
  const archiveStock = useArchiveFeedStock();
  const bulkDeleteStock = useBulkDeleteFeedStock();
  const [deleteTarget, setDeleteTarget] = useState<FeedStock | null>(null);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});

  const sourceById = useMemo(() => {
    const map = new Map<string, FeedStockSource>();
    for (const c of concentrations.data ?? []) {
      map.set(c.id, { name: c.name, kind: c.kind });
    }
    return map;
  }, [concentrations.data]);

  const items = stock.data ?? [];
  const allIds = items.map((s) => s.id);
  const tableSelection = useTableBulkSelection(rowSelection, setRowSelection, allIds);
  const gridSelection = useGridBulkSelection(allIds);
  const selection = view === "table" ? tableSelection : gridSelection;

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    try {
      await archiveStock.mutateAsync(deleteTarget.id);
      toast.success(t("deletedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    } finally {
      setDeleteTarget(null);
    }
  }

  async function handleBulkDelete(ids: string[]) {
    try {
      const result = await bulkDeleteStock.mutateAsync(ids);
      toast.success(t("bulk.deletedToast", { count: result.deleted }));
      selection.clear();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("bulk.genericError"));
    }
  }

  if (stock.isLoading) return <CardSkeleton lines={3} />;
  if (stock.isError) return <ErrorState onRetry={() => stock.refetch()} />;
  if (items.length === 0)
    return (
      <EmptyState
        icon={Package}
        title={t("empty")}
        description={t("emptyDescription")}
        action={
          <Button asChild size="sm">
            <Link href="/feed">{t("emptyCta")}</Link>
          </Button>
        }
      />
    );

  return (
    <>
      {view === "table" ? (
        <FeedStockTable
          items={items}
          isLoading={stock.isLoading}
          isError={stock.isError}
          onRetry={() => void stock.refetch()}
          sourceById={sourceById}
          onDelete={setDeleteTarget}
          enableRowSelection={canDelete}
          rowSelection={rowSelection}
          onRowSelectionChange={setRowSelection}
        />
      ) : (
        <FeedStockGrid
          items={items}
          isLoading={stock.isLoading}
          isError={stock.isError}
          onRetry={() => void stock.refetch()}
          sourceById={sourceById}
          onDelete={setDeleteTarget}
          canSelect={canDelete}
          isSelected={gridSelection.isSelected}
          onToggleSelect={gridSelection.toggle}
        />
      )}
      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title={t("deleteDialog.title", { name: deleteTarget ? sourceById.get(deleteTarget.source_concentration_id)?.name ?? t("unknownSource") : "" })}
        description={t("deleteDialog.description")}
        confirmLabel={t("deleteDialog.confirm")}
        cancelLabel={t("deleteDialog.cancel")}
        onConfirm={handleDeleteConfirm}
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
    </>
  );
}
