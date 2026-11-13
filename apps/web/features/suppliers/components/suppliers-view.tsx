"use client"; // dialog-open state + search state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@rakhal/ui/ui/input";
import { useIncrementalReveal } from "@/lib/hooks/use-incremental-reveal";
import { RecordPurchaseDialog } from "@/features/purchasing/components/record-purchase-dialog";
import { useSuppliers } from "@/features/settings/hooks/use-workspace";
import type { Supplier } from "@/features/settings/types";
import { useSuppliersListV2 } from "../hooks";
import type { SupplierRow } from "../types";
import { SupplierSummaryCards } from "./supplier-summary-cards";
import { SupplierTable } from "./supplier-table";
import { SupplierFormDialog } from "./supplier-form-dialog";
import { SupplierDeleteDialog } from "./supplier-delete-dialog";
import { SupplierDetailSheet } from "./supplier-detail-sheet";

const PAGE_STEP = 20;

/**
 * RAKHAL-390 (MILESTONE 22) — Suppliers directory, now the **Suppliers tab of Purchasing**
 * (2026-10-19 merge; was its own `/suppliers` page). Read side is the aggregate-driven
 * `SupplierTable` (`GET /purchasing/suppliers`, RAKHAL-373); write side (create/edit/deactivate)
 * is the shared `/settings/suppliers` CRUD form. The edit dialog needs the full `Supplier` write shape
 * (`contact`/`category`/`payment_terms`/`notes` — fields the aggregate read model doesn't carry), so
 * it's joined here from `useSuppliers()`'s own list by id rather than adding those fields to the read
 * model, which would blur `SupplierReadService`'s "read-only aggregate sibling" boundary for a
 * form-only concern.
 *
 * **Search + paging are client-side.** `GET /purchasing/suppliers` is deliberately un-paginated (a
 * farm's supplier directory is a small, bounded list — `SupplierReadService`'s own doc comment) and has
 * no `search` param, so the box filters the loaded rows by name / phone and "show more" reveals them
 * `PAGE_STEP` at a time (`useIncrementalReveal`) — no cursor to follow. A row opens
 * `SupplierDetailSheet`; its **Record purchase** opens Record Purchase with that supplier selected.
 *
 * The primary "Add supplier" button lives in `PurchasingView`'s tab toolbar (one primary action per
 * tab), so create-dialog open state is controlled by the parent via `createOpen`.
 */
export function SuppliersView({
  createOpen,
  onCreateOpenChange,
}: {
  createOpen: boolean;
  onCreateOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("suppliers");
  const query = useSuppliersListV2();
  const { data: writeSideSuppliers } = useSuppliers();
  const supplierById = useMemo(
    () => new Map((writeSideSuppliers?.suppliers ?? []).map((s) => [s.id, s])),
    [writeSideSuppliers],
  );

  const [search, setSearch] = useState("");
  const [detailTarget, setDetailTarget] = useState<SupplierRow | null>(null);
  const [editTarget, setEditTarget] = useState<SupplierRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SupplierRow | null>(null);
  const [purchaseFor, setPurchaseFor] = useState<SupplierRow | null>(null);

  const term = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      (query.data ?? []).filter(
        (row) => !term || row.name.toLowerCase().includes(term) || (row.phone ?? "").toLowerCase().includes(term),
      ),
    [query.data, term],
  );
  const { visible, hasMore, showMore } = useIncrementalReveal(filtered, PAGE_STEP, term);

  const formSupplier: Supplier | null = editTarget ? (supplierById.get(editTarget.id) ?? null) : null;

  return (
    <div className="flex flex-col gap-4">
      <SupplierSummaryCards />

      <Input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className="w-full sm:w-[280px]"
      />

      <SupplierTable
        rows={visible}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        onEdit={setEditTarget}
        onDelete={setDeleteTarget}
        onAdd={() => onCreateOpenChange(true)}
        onOpen={setDetailTarget}
        isFiltered={term.length > 0}
        hasNextPage={hasMore}
        onLoadMore={showMore}
      />

      <SupplierDetailSheet
        supplier={detailTarget}
        open={detailTarget !== null}
        onOpenChange={(open) => !open && setDetailTarget(null)}
        onRecordPurchase={(supplier) => {
          setDetailTarget(null);
          setPurchaseFor(supplier);
        }}
        onEdit={(supplier) => {
          setDetailTarget(null);
          setEditTarget(supplier);
        }}
      />

      <RecordPurchaseDialog open={purchaseFor !== null} onOpenChange={(open) => !open && setPurchaseFor(null)} supplierId={purchaseFor?.id} />

      <SupplierFormDialog
        open={createOpen || editTarget !== null}
        onOpenChange={(open) => {
          if (open) return;
          setEditTarget(null);
          onCreateOpenChange(false);
        }}
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
