"use client"; // filter reads (nuqs/searchParams), view toggle state, paged query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useArchiveMedicine, useMedicinePagedList } from "../hooks/use-inventory";
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
  const searchParams = useSearchParams();
  const [editingMedicine, setEditingMedicine] = useState<Medicine | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Medicine | null>(null);
  const archiveMedicine = useArchiveMedicine();

  const filters = {
    search: searchParams.get("search") ?? undefined,
    category: (searchParams.get("category") as MedicineCategory | null) ?? undefined,
    status: (searchParams.get("status") as MedicineListStatus | null) ?? undefined,
  };

  const query = useMedicinePagedList(filters);

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    try {
      await archiveMedicine.mutateAsync(archiveTarget.id);
      toast.success(t("archivedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
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
      </div>

      {view === "table" ? (
        <MedicineTable
          items={query.items}
          startIndex={(query.page - 1) * 20}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onEdit={(medicine) => {
            setEditingMedicine(medicine);
            setFormOpen(true);
          }}
          onArchive={setArchiveTarget}
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
        />
      )}

      <Pagination page={query.page} totalPages={query.totalPages} onPageChange={query.goToPage} disabled={query.isFetching} />

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
    </div>
  );
}
