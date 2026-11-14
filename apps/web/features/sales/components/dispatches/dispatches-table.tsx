"use client"; // infinite query + row action state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { CheckCircle2, MoreVertical, Plus, XCircle } from "lucide-react";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MobileRecordCard } from "@/components/shared/mobile-record-card";
import { MoneyText } from "@/components/shared/money-text";
import { ConfirmDialog } from "@rakhal/ui/shared/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@rakhal/ui/ui/dropdown-menu";
import { Can } from "@/lib/auth/permissions";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { useCancelDispatch, useDispatchesList } from "../../hooks/use-sales";
import { ReceiptConfirmDialog } from "./receipt-confirm-dialog";
import type { DispatchListFilters, DispatchRow, DispatchStatus } from "../../types";

const STATUS_VARIANT: Record<DispatchStatus, "warning" | "success" | "destructive"> = {
  PENDING: "warning",
  DELIVERED: "success",
  CANCELLED: "destructive",
};

/** RAKHAL-388 — the AC's exact column set: `Dispatch No | Date | Buyer | Product | Quantity |
 * Status | Driver | Actions`. `Product` is always "Milk" (`MilkDispatch` has no product field — this
 * whole model is milk-specific). Actions: `Confirm Receipt` (PENDING only, `finance.update`) and
 * `Cancel` (not already CANCELLED, `finance.reverse` owner-only — same tier every other void route
 * in this milestone uses; the backend rejects a sale-linked dispatch that already has an allocated
 * payment, surfaced here as a toast, not a client-side pre-check). */
export function DispatchesTable({ filters, onNewDispatch }: { filters: DispatchListFilters; onNewDispatch?: () => void }) {
  const t = useTranslations("sales.dispatches.table");
  const query = useDispatchesList(filters);
  const cancelDispatch = useCancelDispatch();
  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const [receiptTarget, setReceiptTarget] = useState<DispatchRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<DispatchRow | null>(null);

  async function handleCancel() {
    if (!cancelTarget) return;
    try {
      await cancelDispatch.mutateAsync(cancelTarget.id);
      toast.success(t("cancelledToast"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("genericError"));
    }
  }

  const columns = useMemo<ColumnDef<DispatchRow, unknown>[]>(
    () => [
      { id: "dispatchNo", header: t("dispatchNo"), cell: ({ row }) => <span className="font-mono text-xs">{row.original.dispatchNumber}</span> },
      { id: "date", header: t("date"), cell: ({ row }) => <DateText date={row.original.dispatchedAt} /> },
      { id: "buyer", header: t("buyer"), cell: ({ row }) => row.original.buyer?.name ?? t("noBuyer") },
      { id: "product", header: t("product"), cell: () => t("productMilk") },
      {
        id: "quantity",
        header: t("quantity"),
        cell: ({ row }) => `${row.original.volumeReceivedL ?? row.original.volumeDispatchedL} L`,
      },
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => <Badge variant={STATUS_VARIANT[row.original.status]}>{t(`statusOptions.${row.original.status}`)}</Badge>,
      },
      { id: "driver", header: t("driver"), cell: ({ row }) => row.original.driverName ?? "—" },
      { id: "amount", header: t("amount"), cell: ({ row }) => <MoneyText amount={row.original.calculatedAmount} /> },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const d = row.original;
          if (d.status === "CANCELLED") return null;
          return (
            <Can I="finance.update">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" aria-label={t("rowActions")} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                    <MoreVertical className="size-4" aria-hidden />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {d.status === "PENDING" ? (
                    <DropdownMenuItem onSelect={() => setReceiptTarget(d)}>
                      <CheckCircle2 className="mr-2 size-3.5" aria-hidden />
                      {t("confirmReceipt")}
                    </DropdownMenuItem>
                  ) : null}
                  <Can I="finance.reverse">
                    <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setCancelTarget(d)}>
                      <XCircle className="mr-2 size-3.5" aria-hidden />
                      {t("cancelDispatch")}
                    </DropdownMenuItem>
                  </Can>
                </DropdownMenuContent>
              </DropdownMenu>
            </Can>
          );
        },
      },
    ],
    [t],
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
          emptyState={{
            title: t("emptyTitle"),
            description: t("emptyDescription"),
            action: onNewDispatch ? (
              <Can I="finance.create">
                <Button size="sm" className="gap-1.5" onClick={onNewDispatch}>
                  <Plus className="size-4" aria-hidden />
                  {t("sellMilk")}
                </Button>
              </Can>
            ) : undefined,
          }}
          renderMobileCard={(d) => (
            <MobileRecordCard
              title={d.dispatchNumber}
              subtitle={d.buyer?.name ?? t("noBuyer")}
              trailing={<MoneyText amount={d.calculatedAmount} />}
              badges={<Badge variant={STATUS_VARIANT[d.status]}>{t(`statusOptions.${d.status}`)}</Badge>}
              fields={[
                { label: t("date"), value: <DateText date={d.dispatchedAt} /> },
                { label: t("quantity"), value: `${d.volumeReceivedL ?? d.volumeDispatchedL} L` },
              ]}
              actions={
                d.status === "CANCELLED" ? undefined : (
                  <Can I="finance.update">
                    {d.status === "PENDING" ? (
                      <Button size="sm" variant="secondary" onClick={() => setReceiptTarget(d)}>
                        {t("confirmReceipt")}
                      </Button>
                    ) : null}
                    <Can I="finance.reverse">
                      <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setCancelTarget(d)}>
                        {t("cancelDispatch")}
                      </Button>
                    </Can>
                  </Can>
                )
              }
            />
          )}
          hasNextPage={query.hasNextPage}
          isFetchingNextPage={query.isFetchingNextPage}
          onLoadMore={() => void query.fetchNextPage()}
        />
      </div>

      <ReceiptConfirmDialog dispatch={receiptTarget} open={receiptTarget !== null} onOpenChange={(open) => !open && setReceiptTarget(null)} />
      <ConfirmDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => !open && setCancelTarget(null)}
        title={t("cancelConfirmTitle")}
        description={t("cancelConfirmDescription")}
        confirmLabel={t("cancelDispatch")}
        onConfirm={handleCancel}
      />
    </>
  );
}
