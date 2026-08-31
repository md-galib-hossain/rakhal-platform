"use client"; // infinite query + column defs + void dialog state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { Can } from "@/lib/auth/permissions";
import { VoidDocumentDialog } from "@/features/finance/components/void-document-dialog";
import { useSuppliers } from "@/features/settings/hooks/use-workspace";
import { usePayables, usePurchasesList, useVoidPurchase } from "../hooks/use-purchasing";
import type { PayableStatus, PurchaseListRow, PurchasingListFilters } from "../types";

const VARIANT_BY_STATUS: Record<PayableStatus, "warning" | "success" | "destructive"> = {
  UNPAID: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "destructive",
};

/** RAKHAL-391/392 (MILESTONE 22) — the AC's exact column set: `Reference | Supplier | Date | Total |
 * Paid Amount | Status | Due Date`, plus (RAKHAL-392) a `Voided` badge and a `Void` row action
 * (`finance.reverse`-gated, `POST /purchasing/purchases/:id/void`) — the backend itself refuses a
 * purchase with any allocated payment, surfaced via `VoidDocumentDialog`'s own error toast. `Supplier`
 * is joined client-side from `useSuppliers()` (settings) by `supplierId` (a real `Supplier` FK since
 * RAKHAL-365) — `GET /purchasing/purchases` doesn't include the relation. `Paid Amount`/`Status`/
 * `Due Date` are derived from the row's own `Payable` (cross-referenced from `GET /purchasing/
 * payables`): no `Payable` means paid in full at creation. */
export function PurchasesTable({ filters }: { filters: PurchasingListFilters }) {
  const t = useTranslations("purchasing.purchasesTable");
  const query = usePurchasesList(filters);
  const { data: payablesPage } = usePayables();
  const { data: suppliersData } = useSuppliers();
  const voidPurchase = useVoidPurchase();
  const [voidTarget, setVoidTarget] = useState<PurchaseListRow | null>(null);

  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const payableByPurchaseId = useMemo(
    () => new Map((payablesPage?.items ?? []).map((p) => [p.purchaseId, p])),
    [payablesPage],
  );
  const supplierNameById = useMemo(
    () => new Map((suppliersData?.suppliers ?? []).map((s) => [s.id, s.name])),
    [suppliersData],
  );

  const columns = useMemo<ColumnDef<PurchaseListRow, unknown>[]>(
    () => [
      {
        id: "reference",
        header: t("reference"),
        cell: ({ row }) => <span className="font-mono text-xs text-foreground">{row.original.purchaseNumber}</span>,
      },
      {
        id: "supplier",
        header: t("supplier"),
        cell: ({ row }) =>
          row.original.supplierId ? (supplierNameById.get(row.original.supplierId) ?? t("unknownSupplier")) : t("noSupplier"),
      },
      {
        id: "date",
        header: t("date"),
        cell: ({ row }) => <DateText date={row.original.purchaseDate} />,
      },
      {
        id: "total",
        header: t("total"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.totalAmount)} className="font-medium" />,
      },
      {
        id: "paidAmount",
        header: t("paidAmount"),
        cell: ({ row }) => {
          const payable = payableByPurchaseId.get(row.original.id);
          const total = Number(row.original.totalAmount);
          const paid = payable ? total - Number(payable.outstanding) : total;
          return <MoneyText amount={paid} />;
        },
      },
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => {
          const payable = payableByPurchaseId.get(row.original.id);
          return (
            <div className="flex items-center gap-1.5">
              {!payable ? (
                <Badge variant="success">{t("paidInFull")}</Badge>
              ) : (
                <Badge variant={VARIANT_BY_STATUS[payable.status]}>{t(`statusOptions.${payable.status}`)}</Badge>
              )}
              {row.original.status === "VOIDED" ? <Badge variant="destructive">{t("voided")}</Badge> : null}
            </div>
          );
        },
      },
      {
        id: "dueDate",
        header: t("dueDate"),
        cell: ({ row }) => {
          const payable = payableByPurchaseId.get(row.original.id);
          return payable?.dueDate ? <DateText date={payable.dueDate} /> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.status === "VOIDED" ? null : (
            <Can I="finance.reverse">
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setVoidTarget(row.original)}>
                {t("void")}
              </Button>
            </Can>
          ),
      },
    ],
    [t, payableByPurchaseId, supplierNameById],
  );

  return (
    <>
      <div className="overflow-hidden rounded-2xl border border-border [&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted [&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground [&_tbody_td]:py-2">
        <DataTable
          columns={columns}
          data={rows}
          getRowId={(row) => row.id}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          emptyState={{ title: t("emptyTitle"), description: t("emptyDescription") }}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      </div>

      <VoidDocumentDialog
        open={voidTarget !== null}
        onOpenChange={(open) => !open && setVoidTarget(null)}
        variant="void"
        documentLabel={voidTarget?.purchaseNumber ?? ""}
        onConfirm={() => voidPurchase.mutateAsync(voidTarget!.id)}
      />
    </>
  );
}
