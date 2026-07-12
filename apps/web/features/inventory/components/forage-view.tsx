"use client"; // filter reads (nuqs/searchParams), view toggle state, paged query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useArchiveForage, useForagePagedList } from "../hooks/use-inventory";
import { ForageFilters } from "./forage-filters";
import { ForageAddButton } from "./forage-add-button";
import { ForageTable } from "./forage-table";
import { ForageGrid } from "./forage-grid";
import { ForageFormDialog } from "./forage-form-dialog";
import { ForageDetailSheet } from "./forage-detail-sheet";
import type { Forage, ForageType } from "../types";

/** Forage tab body — search/filter row, table/grid view (view state owned by the parent
 * `InventoryTabs`), pagination, and the view/add/edit/archive flows. Same shape as `MedicineView`,
 * plus a "View Details" sheet Medicine doesn't have yet (Figma gave Forage a dedicated one). */
export function ForageView({ view }: { view: "table" | "grid" }) {
  const t = useTranslations("inventory.forage");
  const searchParams = useSearchParams();
  const [viewingId, setViewingId] = useState<string | undefined>(undefined);
  const [editingForage, setEditingForage] = useState<Forage | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Forage | null>(null);
  const archiveForage = useArchiveForage();

  const filters = {
    search: searchParams.get("search") ?? undefined,
    type: (searchParams.get("type") as ForageType | null) ?? undefined,
  };

  const query = useForagePagedList(filters);

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    try {
      await archiveForage.mutateAsync(archiveTarget.id);
      toast.success(t("archivedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ForageFilters
        actions={
          <ForageAddButton
            onClick={() => {
              setEditingForage(undefined);
              setFormOpen(true);
            }}
          />
        }
      />

      {view === "table" ? (
        <ForageTable
          items={query.items}
          startIndex={(query.page - 1) * 20}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onView={(forage) => setViewingId(forage.id)}
          onEdit={(forage) => {
            setEditingForage(forage);
            setFormOpen(true);
          }}
          onArchive={setArchiveTarget}
        />
      ) : (
        <ForageGrid
          items={query.items}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onView={(forage) => setViewingId(forage.id)}
          onEdit={(forage) => {
            setEditingForage(forage);
            setFormOpen(true);
          }}
          onArchive={setArchiveTarget}
        />
      )}

      <Pagination page={query.page} totalPages={query.totalPages} onPageChange={query.goToPage} disabled={query.isFetching} />

      <ForageFormDialog open={formOpen} onOpenChange={setFormOpen} forage={editingForage} />
      <ForageDetailSheet
        forageId={viewingId}
        onOpenChange={(open) => !open && setViewingId(undefined)}
        onEdit={(forage) => {
          setViewingId(undefined);
          setEditingForage(forage);
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
