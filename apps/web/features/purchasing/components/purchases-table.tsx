"use client"; // infinite query + column defs + void / pay / detail state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Plus } from "lucide-react";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MobileRecordCard } from "@rakhal/ui/shared/mobile-record-card";
import { MoneyText } from "@/components/shared/money-text";
import { Can } from "@/lib/auth/permissions";
import { VoidDocumentDialog } from "@/features/finance/components/void-document-dialog";
import { useSuppliers } from "@/features/settings/hooks/use-workspace";
import { usePurchasesList, useVoidPurchase } from "../hooks/use-purchasing";
import type { PayableStatus, PurchaseListRow, PurchasingListFilters } from "../types";
import { PurchaseDetailSheet } from "./purchase-detail-sheet";
import { PurchasePayDialog } from "./purchase-pay-dialog";

const VARIANT_BY_STATUS: Record<PayableStatus, "warning" | "success" | "destructive"> = {
  UNPAID: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "destructive",
};

/** RAKHAL-391/392 (MILESTONE 22) — the AC's exact column set: `Reference | Supplier | Date | Total |
 * Paid Amount | Status`, plus (RAKHAL-392) a `Voided` badge and a `Void` row action
 * (`finance.reverse`-gated, `POST /purchasing/purchases/:id/void`).
 *
 * **Payment state is the server's** (Business UX Phase 5): each row carries `paymentStatus` /
 * `outstanding` / `paidAmount` derived in `PurchaseService.findAll`, so the table no longer matches a
 * purchase against `GET /purchasing/payables?limit=100` (which showed a false "Paid in full" for any
 * purchase beyond the first 100 payables). A voided purchase has `paymentStatus: null` and shows only
 * the Voided badge. The list row has no `dueDate` (`derivePurchasePayment` returns only status /
 * outstanding / paid, the payable is dropped from the row), so the **Due Date** column moved into the
 * detail sheet, which reads it from the embedded payable; an Overdue badge still flags late rows. A row with something outstanding gets a **Pay** action (`finance.create`), and
 * clicking a row opens `PurchaseDetailSheet` (lines, payments, void, cross-links). `Supplier` is joined
 * client-side from `useSuppliers()` by `supplierId` — the list endpoint doesn't include the relation.
 * Below `sm` the table collapses to `MobileRecordCard`s. */
export function PurchasesTable({ filters, onRecord }: { filters: PurchasingListFilters; onRecord?: () => void }) {
  const t = useTranslations("purchasing.purchasesTable");
  const query = usePurchasesList(filters);
  const { data: suppliersData } = useSuppliers();
  const voidPurchase = useVoidPurchase();
  const [voidTarget, setVoidTarget] = useState<PurchaseListRow | null>(null);
  const [payTarget, setPayTarget] = useState<PurchaseListRow | null>(null);
  const [detailTarget, setDetailTarget] = useState<PurchaseListRow | null>(null);

  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const supplierNameById = useMemo(
    () => new Map((suppliersData?.suppliers ?? []).map((s) => [s.id, s.name])),
    [suppliersData],
  );
  const supplierName = (row: PurchaseListRow) =>
    row.supplierId ? (supplierNameById.get(row.supplierId) ?? t("unknownSupplier")) : t("noSupplier");

  const statusBadges = (row: PurchaseListRow) => (
    <>
      {row.paymentStatus ? <Badge variant={VARIANT_BY_STATUS[row.paymentStatus]}>{t(`statusOptions.${row.paymentStatus}`)}</Badge> : null}
      {row.status === "VOIDED" ? <Badge variant="destructive">{t("voided")}</Badge> : null}
    </>
  );

  const canPay = (row: PurchaseListRow) => row.status !== "VOIDED" && Number(row.outstanding) > 0;

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
        cell: ({ row }) => <MoneyText amount={Number(row.original.paidAmount)} />,
      },
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => <div className="flex items-center gap-1.5">{statusBadges(row.original)}</div>,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.status === "VOIDED" ? null : (
            <div className="flex items-center gap-1">
              {canPay(row.original) ? (
                <Can I="finance.create">
                  <Button size="sm" variant="secondary" onClick={() => setPayTarget(row.original)}>
                    {t("pay")}
                  </Button>
                </Can>
              ) : null}
              <Can I="finance.reverse">
                <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setVoidTarget(row.original)}>
                  {t("void")}
                </Button>
              </Can>
            </div>
          ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `statusBadges`/`canPay` are pure closures over `t`
    [t, supplierNameById],
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
          onRowClick={setDetailTarget}
          emptyState={{
            title: t("emptyTitle"),
            description: t("emptyDescription"),
            action: onRecord ? (
              <Can I="purchasing.create">
                <Button size="sm" className="gap-1.5" onClick={onRecord}>
                  <Plus className="size-4" aria-hidden />
                  {t("recordPurchase")}
                </Button>
              </Can>
            ) : undefined,
          }}
          renderMobileCard={(row) => (
            <MobileRecordCard
              title={row.purchaseNumber}
              subtitle={supplierName(row)}
              trailing={<MoneyText amount={Number(row.totalAmount)} />}
              badges={statusBadges(row)}
              onOpen={() => setDetailTarget(row)}
              fields={[
                { label: t("date"), value: <DateText date={row.purchaseDate} /> },
                { label: t("paidAmount"), value: <MoneyText amount={Number(row.paidAmount)} /> },
              ]}
              actions={
                row.status === "VOIDED" ? undefined : (
                  <>
                    {canPay(row) ? (
                      <Can I="finance.create">
                        <Button size="sm" variant="secondary" onClick={() => setPayTarget(row)}>
                          {t("pay")}
                        </Button>
                      </Can>
                    ) : null}
                    <Can I="finance.reverse">
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setVoidTarget(row)}>
                        {t("void")}
                      </Button>
                    </Can>
                  </>
                )
              }
            />
          )}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      </div>

      <PurchaseDetailSheet
        purchase={detailTarget}
        supplierName={detailTarget ? supplierName(detailTarget) : undefined}
        open={detailTarget !== null}
        onOpenChange={(open) => !open && setDetailTarget(null)}
        onPay={(purchase) => {
          setDetailTarget(null);
          setPayTarget(purchase);
        }}
        onVoid={(purchase) => {
          setDetailTarget(null);
          setVoidTarget(purchase);
        }}
      />

      <PurchasePayDialog purchase={payTarget} open={payTarget !== null} onOpenChange={(open) => !open && setPayTarget(null)} />

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
