"use client"; // filter reads (searchParams), paged query, dialog state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Plus } from "lucide-react";
import { FilterBar } from "@/components/shared/filter-bar";
import { Pagination } from "@/components/shared/pagination";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/shared/confirm-dialog";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Can } from "@/lib/auth/permissions";
import { useBuyersPagedList, useDeactivateBuyer } from "../hooks/use-buyers";
import { BuyerSummaryCards } from "./buyer-summary-cards";
import { BuyerTable } from "./buyer-table";
import { BuyerFormDialog } from "./buyer-form-dialog";
import { SellMilkSheet } from "@/features/sales/components/sell-milk-sheet";
import { BuyerStatementDialog } from "./buyer-statement-dialog";
import type { BuyerListRow } from "../types";

/** Buyers tab body — the AC's 4-stat Buyer Summary (RAKHAL-389, `GET /buyers/summary`) above the
 * directory (search + create/edit + deactivate) plus the per-row Sell milk / Statement
 * actions. No Figma frame supplied for this module (RFE-026's own note: "Design: Figma if
 * present, else PRD-spec") — built against the real backend contract. */
export function BuyersView() {
  const t = useTranslations("buyers.list");
  const searchParams = useSearchParams();
  // includeArchived: true — Total Buyers (`GET /buyers/summary`) counts every buyer ever created,
  // deactivated ones included, but this list defaulted to active-only (`includeArchived: false`),
  // so a farm whose one buyer had been deactivated showed "Total Buyers: 1" above an empty "No
  // buyers yet" table. The row already renders an Inactive badge (`buyer-columns.tsx`) and only
  // shows the Deactivate action when `status === "ACTIVE"`, so archived buyers are safe to list.
  const filters = { search: searchParams.get("search") ?? undefined, includeArchived: true };
  const query = useBuyersPagedList(filters);
  const deactivateBuyer = useDeactivateBuyer();

  const [formTarget, setFormTarget] = useState<BuyerListRow | "new" | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<BuyerListRow | null>(null);
  const [sellMilkTarget, setSellMilkTarget] = useState<BuyerListRow | null>(null);
  const [statementTarget, setStatementTarget] = useState<BuyerListRow | null>(null);

  async function handleDeactivate() {
    if (!deactivateTarget) return;
    try {
      await deactivateBuyer.mutateAsync(deactivateTarget.id);
      toast.success(t("deactivatedToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("deactivateError"));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <BuyerSummaryCards />

      <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <FilterBar searchKey="search" searchPlaceholder={t("searchPlaceholder")} />
          <Can I="finance.create">
            <Button variant="primary" className="gap-2" onClick={() => setFormTarget("new")}>
              <Plus className="size-[18px]" aria-hidden />
              {t("addBuyer")}
            </Button>
          </Can>
        </div>

        <BuyerTable
          items={query.items}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onEdit={setFormTarget}
          onDeactivate={setDeactivateTarget}
          onStatement={setStatementTarget}
          onSellMilk={setSellMilkTarget}
          onAdd={() => setFormTarget("new")}
        />

        <Pagination
          page={query.page}
          totalPages={query.totalPages}
          onPageChange={query.goToPage}
          isFetching={query.isFetching}
          pageSize={query.pageSize}
          onPageSizeChange={query.setPageSize}
        />
      </div>

      <BuyerFormDialog
        buyer={formTarget === "new" || formTarget === null ? null : formTarget}
        open={formTarget != null}
        onOpenChange={(open) => !open && setFormTarget(null)}
      />
      <ConfirmDialog
        open={deactivateTarget != null}
        onOpenChange={(open) => !open && setDeactivateTarget(null)}
        title={t("deactivateTitle")}
        description={deactivateTarget ? t("deactivateDescription", { name: deactivateTarget.name }) : undefined}
        confirmLabel={t("deactivateConfirm")}
        onConfirm={handleDeactivate}
      />
      <SellMilkSheet open={sellMilkTarget != null} onOpenChange={(open) => !open && setSellMilkTarget(null)} buyerId={sellMilkTarget?.id} />
      <BuyerStatementDialog buyer={statementTarget} open={statementTarget != null} onOpenChange={(open) => !open && setStatementTarget(null)} />
    </div>
  );
}
