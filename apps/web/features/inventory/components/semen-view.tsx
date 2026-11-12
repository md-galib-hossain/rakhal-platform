"use client"; // dialog open state + tanks/batches queries

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Droplet, Plus, Search, Warehouse } from "lucide-react";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { InfiniteScrollFooter } from "@/components/shared/infinite-scroll-footer";
import { useArchiveSemenBatch, useSemenBatchInfiniteList, useSemenTanks } from "../hooks/use-inventory";
import { SemenTankCard } from "./semen-tank-card";
import { SemenTankFormDialog } from "./semen-tank-form-dialog";
import { SemenTankDetailsDialog } from "./semen-tank-details-dialog";
import { SemenBatchCard } from "./semen-batch-card";
import { SemenBatchFormDialog } from "./semen-batch-form-dialog";
import type { SemenBatch, SemenTank } from "../types";

/**
 * Semen tab body — Figma "Inventory - Semen" (732:20158, `get_design_context`): "Physical Storage"
 * tank grid (+ "Add New Tank") in one card, "Active Straw Batches" (+ search + "Add Straw") in
 * another below. Straw batches use the same infinite-scroll `InfiniteScrollFooter` as every other
 * cursor-backed list in this codebase (Medicine/FeedItem/Milk audit log) rather than the mock's
 * unpaginated 3-card row, since a farm can accumulate far more batches than fit on one screen.
 */
export function SemenView() {
  const t = useTranslations("inventory.semen");
  const tanksQuery = useSemenTanks();
  const [search, setSearch] = useState("");
  const batchesQuery = useSemenBatchInfiniteList({ search: search || undefined });
  const archiveBatch = useArchiveSemenBatch();

  const [tankFormOpen, setTankFormOpen] = useState(false);
  const [editingTank, setEditingTank] = useState<SemenTank | undefined>(undefined);
  const [detailsTank, setDetailsTank] = useState<SemenTank | undefined>(undefined);

  const [batchFormOpen, setBatchFormOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<SemenBatch | undefined>(undefined);
  const [archivingBatch, setArchivingBatch] = useState<SemenBatch | undefined>(undefined);

  const tanks = tanksQuery.data ?? [];
  const tanksById = new Map(tanks.map((tank) => [tank.id, tank]));

  async function handleArchiveConfirm() {
    if (!archivingBatch) return;
    try {
      await archiveBatch.mutateAsync(archivingBatch.id);
      toast.success(t("batchCard.archivedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("batchCard.genericError"));
    } finally {
      setArchivingBatch(undefined);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-6 rounded-2xl bg-card p-4 shadow-[0px_0px_3px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xl font-bold text-foreground">{t("physicalStorage")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setEditingTank(undefined);
              setTankFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden />
            {t("addNewTank")}
          </Button>
        </div>

        {tanksQuery.isError ? (
          <ErrorState onRetry={() => void tanksQuery.refetch()} />
        ) : !tanksQuery.isLoading && tanks.length === 0 ? (
          <EmptyState
            icon={Warehouse}
            title={t("emptyTanks.title")}
            description={t("emptyTanks.description")}
            action={
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingTank(undefined);
                  setTankFormOpen(true);
                }}
              >
                {t("addNewTank")}
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {tanks.map((tank) => (
              <SemenTankCard key={tank.id} tank={tank} onOpenDetails={setDetailsTank} />
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col gap-6 rounded-2xl bg-card p-4 shadow-[0px_0px_3px_rgba(0,0,0,0.1)]">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <p className="text-xl font-bold text-foreground">{t("activeStrawBatches")}</p>
            <span className="rounded-full border border-info bg-card px-3 py-1 text-xs font-bold text-info">
              {t("totalBatch", { count: batchesQuery.items.length })}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative w-60">
              <Search className="absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("searchPlaceholder")} className="pl-9" />
            </div>
            <Button
              type="button"
              onClick={() => {
                setEditingBatch(undefined);
                setBatchFormOpen(true);
              }}
            >
              <Plus className="size-4" aria-hidden />
              {t("addStraw")}
            </Button>
          </div>
        </div>

        {batchesQuery.isError ? (
          <ErrorState onRetry={() => void batchesQuery.refetch()} />
        ) : !batchesQuery.isLoading && batchesQuery.items.length === 0 ? (
          <EmptyState
            icon={Droplet}
            title={t("emptyBatches.title")}
            description={t("emptyBatches.description")}
            action={
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setEditingBatch(undefined);
                  setBatchFormOpen(true);
                }}
              >
                {t("addStraw")}
              </Button>
            }
          />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {batchesQuery.items.map((batch) => (
                <SemenBatchCard
                  key={batch.id}
                  batch={batch}
                  tank={batch.tankId ? tanksById.get(batch.tankId) : undefined}
                  onEdit={(b) => {
                    setEditingBatch(b);
                    setBatchFormOpen(true);
                  }}
                  onArchive={setArchivingBatch}
                />
              ))}
            </div>
            <InfiniteScrollFooter
              hasNextPage={batchesQuery.hasNextPage}
              isFetchingNextPage={batchesQuery.isFetchingNextPage}
              isError={batchesQuery.isNextPageError}
              onLoadMore={batchesQuery.fetchNextPage}
              loadedCount={batchesQuery.items.length}
            />
          </>
        )}
      </div>

      <SemenTankFormDialog open={tankFormOpen} onOpenChange={setTankFormOpen} tank={editingTank} />
      <SemenTankDetailsDialog tank={detailsTank} onOpenChange={(open) => !open && setDetailsTank(undefined)} />
      <SemenBatchFormDialog open={batchFormOpen} onOpenChange={setBatchFormOpen} batch={editingBatch} />
      <ConfirmDialog
        open={Boolean(archivingBatch)}
        onOpenChange={(open) => !open && setArchivingBatch(undefined)}
        title={t("batchCard.archiveDialog.title", { name: archivingBatch?.name ?? "" })}
        description={t("batchCard.archiveDialog.description")}
        confirmLabel={t("batchCard.archiveDialog.confirm")}
        cancelLabel={t("batchCard.archiveDialog.cancel")}
        onConfirm={handleArchiveConfirm}
      />
    </div>
  );
}
