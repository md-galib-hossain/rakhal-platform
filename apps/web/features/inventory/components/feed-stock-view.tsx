"use client"; // live query, joins stock lots against the cached concentrations list for source name+kind

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Package } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useArchiveFeedStock, useConcentrations, useFeedStock } from "@/features/feed/hooks/use-feed";
import type { FeedStock } from "@/features/feed/types";
import { FeedStockTable } from "./feed-stock-table";
import { FeedStockGrid } from "./feed-stock-grid";
import type { FeedStockSource } from "./feed-stock-columns";

/**
 * Inventory's Feed tab → "Prepared" segment (moved here 2026-07-19 from a standalone section on
 * the Feed Formulator page — user report: "we have already a inventory... no need to create the
 * tmr feed inventory here"; folded into the unified Feed tab's segmented control alongside
 * "Purchased" at `feed_taxonomy_unification`). List of `FeedStock` lots produced by finalizing a
 * **Total Mixed Ration** on the Feed Formulator page; actual stock *decrement* happens through
 * "Feed Today" (`features/feed/components/log-distribution-dialog.tsx`), not here. A Concentrate
 * Mixer never appears here (2026-07-19 correction, see `FeedConcentrationService.finalize`'s doc
 * comment) — it's a virtual recipe/calculator, finalizing one only promotes a reusable ingredient
 * and never touches inventory; only a TMR is real, physical feed.
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
 * archive flow.
 */
export function FeedStockView({ view }: { view: "table" | "grid" }) {
  const t = useTranslations("feed.stock");
  const stock = useFeedStock();
  const concentrations = useConcentrations();
  const archiveStock = useArchiveFeedStock();
  const [deleteTarget, setDeleteTarget] = useState<FeedStock | null>(null);

  const sourceById = useMemo(() => {
    const map = new Map<string, FeedStockSource>();
    for (const c of concentrations.data ?? []) {
      map.set(c.id, { name: c.name, kind: c.kind });
    }
    return map;
  }, [concentrations.data]);

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

  if (stock.isLoading) return <CardSkeleton lines={3} />;
  if (stock.isError) return <ErrorState onRetry={() => stock.refetch()} />;
  if ((stock.data ?? []).length === 0) return <EmptyState icon={Package} title={t("empty")} />;

  const items = stock.data ?? [];

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
        />
      ) : (
        <FeedStockGrid
          items={items}
          isLoading={stock.isLoading}
          isError={stock.isError}
          onRetry={() => void stock.refetch()}
          sourceById={sourceById}
          onDelete={setDeleteTarget}
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
    </>
  );
}
