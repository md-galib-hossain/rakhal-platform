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
import { useBuyersPagedList, useDeactivateBuyer } from "../hooks/use-buyers";
import { BuyerTable } from "./buyer-table";
import { BuyerFormDialog } from "./buyer-form-dialog";
import { RecordDispatchDialog } from "./record-dispatch-dialog";
import { BuyerStatementDialog } from "./buyer-statement-dialog";
import type { Buyer } from "../types";

/** Buyers tab body — buyer directory (search + create/edit + deactivate) plus the per-row
 * Record Dispatch / Statement actions. No Figma frame supplied for this module (RFE-026's own
 * note: "Design: Figma if present, else PRD-spec") — built against the real backend contract. */
export function BuyersView() {
  const t = useTranslations("buyers.list");
  const searchParams = useSearchParams();
  const filters = { search: searchParams.get("search") ?? undefined };
  const query = useBuyersPagedList(filters);
  const deactivateBuyer = useDeactivateBuyer();

  const [formTarget, setFormTarget] = useState<Buyer | "new" | null>(null);
  const [deactivateTarget, setDeactivateTarget] = useState<Buyer | null>(null);
  const [dispatchTarget, setDispatchTarget] = useState<Buyer | null>(null);
  const [statementTarget, setStatementTarget] = useState<Buyer | null>(null);

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
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <FilterBar searchKey="search" searchPlaceholder={t("searchPlaceholder")} />
        <Button variant="primary" className="gap-2" onClick={() => setFormTarget("new")}>
          <Plus className="size-[18px]" aria-hidden />
          {t("addBuyer")}
        </Button>
      </div>

      <BuyerTable
        items={query.items}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => void query.refetch()}
        onEdit={setFormTarget}
        onDeactivate={setDeactivateTarget}
        onStatement={setStatementTarget}
        onRecordDispatch={setDispatchTarget}
      />

      <Pagination
        page={query.page}
        totalPages={query.totalPages}
        onPageChange={query.goToPage}
        isFetching={query.isFetching}
        pageSize={query.pageSize}
        onPageSizeChange={query.setPageSize}
      />

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
      <RecordDispatchDialog buyer={dispatchTarget} open={dispatchTarget != null} onOpenChange={(open) => !open && setDispatchTarget(null)} />
      <BuyerStatementDialog buyer={statementTarget} open={statementTarget != null} onOpenChange={(open) => !open && setStatementTarget(null)} />
    </div>
  );
}
