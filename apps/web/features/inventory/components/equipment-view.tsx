"use client"; // filter reads (nuqs/searchParams), view toggle state, paged query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { ApiError } from "@/lib/api/errors";
import { Pagination } from "@/components/shared/pagination";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { useArchiveEquipment, useEquipmentPagedList } from "../hooks/use-inventory";
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
  const searchParams = useSearchParams();
  const [editingEquipment, setEditingEquipment] = useState<Equipment | undefined>(undefined);
  const [formOpen, setFormOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<Equipment | null>(null);
  const archiveEquipment = useArchiveEquipment();

  const filters = {
    search: searchParams.get("search") ?? undefined,
    type: (searchParams.get("type") as EquipmentType | null) ?? undefined,
  };

  const query = useEquipmentPagedList(filters);

  async function handleArchiveConfirm() {
    if (!archiveTarget) return;
    try {
      await archiveEquipment.mutateAsync(archiveTarget.id);
      toast.success(t("archivedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
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
          startIndex={(query.page - 1) * 20}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onEdit={(equipment) => {
            setEditingEquipment(equipment);
            setFormOpen(true);
          }}
          onArchive={setArchiveTarget}
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
        />
      )}

      <Pagination page={query.page} totalPages={query.totalPages} onPageChange={query.goToPage} disabled={query.isFetching} />

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
    </div>
  );
}
