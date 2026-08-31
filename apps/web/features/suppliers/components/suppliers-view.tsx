"use client"; // dialog-open state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { useSuppliers } from "@/features/settings/hooks/use-workspace";
import type { Supplier } from "@/features/settings/types";
import { useSuppliersListV2 } from "../hooks";
import type { SupplierRow } from "../types";
import { SupplierSummaryCards } from "./supplier-summary-cards";
import { SupplierTable } from "./supplier-table";
import { SupplierFormDialog } from "./supplier-form-dialog";
import { SupplierDeleteDialog } from "./supplier-delete-dialog";

/**
 * RAKHAL-390 (MILESTONE 22) — Suppliers module top-level screen. Read side is the aggregate-driven
 * `SupplierTable` (`GET /purchasing/suppliers`, RAKHAL-373); write side (create/edit/deactivate)
 * reuses the existing `/settings/suppliers` CRUD form. The edit dialog needs the full `Supplier`
 * write shape (`contact`/`category`/`payment_terms`/`notes` — fields the aggregate read model
 * doesn't carry), so it's joined here from `useSuppliers()`'s own list by id rather than adding
 * those fields to the read model, which would blur `SupplierReadService`'s "read-only aggregate
 * sibling" boundary (`supplier-read.service.ts`'s own doc comment) for a form-only concern.
 */
export function SuppliersView() {
  const t = useTranslations("suppliers");
  const query = useSuppliersListV2();
  const { data: writeSideSuppliers } = useSuppliers();
  const supplierById = useMemo(
    () => new Map((writeSideSuppliers?.suppliers ?? []).map((s) => [s.id, s])),
    [writeSideSuppliers],
  );

  const [formTarget, setFormTarget] = useState<SupplierRow | "new" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierRow | null>(null);

  const formSupplier: Supplier | null =
    formTarget && formTarget !== "new" ? (supplierById.get(formTarget.id) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-lg font-medium text-foreground">{t("title")}</p>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Can I="settings.update">
          <Button size="sm" className="gap-1.5" onClick={() => setFormTarget("new")}>
            <Plus className="size-4" aria-hidden />
            {t("table.addSupplier")}
          </Button>
        </Can>
      </div>

      <SupplierSummaryCards />

      <SupplierTable
        rows={query.data ?? []}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        onEdit={setFormTarget}
        onDelete={setDeleteTarget}
        onAdd={() => setFormTarget("new")}
      />

      <SupplierFormDialog
        open={formTarget !== null}
        onOpenChange={(open) => !open && setFormTarget(null)}
        supplier={formSupplier}
      />

      <SupplierDeleteDialog
        supplier={deleteTarget}
        open={deleteTarget != null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
      />
    </div>
  );
}
