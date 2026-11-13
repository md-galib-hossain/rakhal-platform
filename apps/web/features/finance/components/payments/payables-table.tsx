"use client"; // columns need translation + row-action callbacks

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Button } from "@rakhal/ui/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { Can } from "@/lib/auth/permissions";
import { useExpensesLookup, usePurchasesLookup } from "../../hooks/use-finance-v2";
import { useSuppliers } from "@/features/settings/hooks/use-workspace";
import { PaymentStatusBadge } from "./payment-status-badge";
import type { Payable } from "../../types-v2";

/**
 * RAKHAL-358 — Payables list, V2. Mirrors `ReceivablesTable` exactly on the liability side. A
 * `Payable` is raised from exactly one of a `Purchase` (`purchaseId` set) or an `Expense`
 * (`expenseId` set) — see `payable.prisma`'s own doc comment — so the reference column checks
 * `purchaseId` first, falling back to `expenseId`'s lookup, mirroring `PayableService`'s own
 * "exactly one of the two" invariant rather than assuming purchases only. **RAKHAL-386** — the
 * "supplier" column now joins `Payable.supplierId` (a real `Supplier` FK since RAKHAL-365) against
 * `useSuppliers()` (settings feature's own small un-paginated directory, `GET /settings/suppliers`)
 * instead of rendering the raw id string — closes the "No supplier" placeholder gap the ticket's AC
 * names. Neither `Purchase` nor `Expense` carries a supplier join of its own, but `Payable.supplierId`
 * is set directly regardless of which document raised it, so this one lookup covers both cases.
 */
export function PayablesTable({
  items,
  isLoading,
  isError,
  onRetry,
  onMakePayment,
  onViewHistory,
}: {
  items: Payable[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onMakePayment: (payable: Payable) => void;
  onViewHistory: (payable: Payable) => void;
}) {
  const t = useTranslations("finance.settlementsV2.payables");
  const tHistory = useTranslations("finance.settlementsV2.paymentHistory");
  const { data: purchases } = usePurchasesLookup();
  const { data: expenses } = useExpensesLookup();
  const { data: suppliers } = useSuppliers();
  const purchaseById = useMemo(() => new Map((purchases ?? []).map((p) => [p.id, p])), [purchases]);
  const expenseById = useMemo(() => new Map((expenses ?? []).map((e) => [e.id, e])), [expenses]);
  const supplierById = useMemo(() => new Map((suppliers?.suppliers ?? []).map((s) => [s.id, s])), [suppliers]);

  const columns = useMemo<ColumnDef<Payable, unknown>[]>(
    () => [
      {
        id: "reference",
        header: t("columns.reference"),
        cell: ({ row }) => {
          const purchase = row.original.purchaseId ? purchaseById.get(row.original.purchaseId) : undefined;
          const expense = row.original.expenseId ? expenseById.get(row.original.expenseId) : undefined;
          const label = purchase?.purchaseNumber ?? expense?.description ?? t("noReference");
          return (
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{label}</span>
              <span className="text-xs text-muted-foreground">
                <DateText date={row.original.createdAt} />
              </span>
            </div>
          );
        },
      },
      {
        id: "supplier",
        header: t("columns.customer"),
        cell: ({ row }) => {
          const supplier = row.original.supplierId ? supplierById.get(row.original.supplierId) : undefined;
          return <span className="text-sm text-foreground">{supplier?.name ?? t("noCustomer")}</span>;
        },
      },
      {
        id: "total",
        header: t("columns.total"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.totalAmount)} />,
      },
      {
        id: "outstanding",
        header: t("columns.outstanding"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.outstanding)} />,
      },
      {
        id: "dueDate",
        header: t("columns.dueDate"),
        cell: ({ row }) => (row.original.dueDate ? <DateText date={row.original.dueDate} /> : "—"),
      },
      {
        id: "status",
        header: t("columns.status"),
        cell: ({ row }) => <PaymentStatusBadge status={row.original.status} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <div className="flex items-center justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => onViewHistory(row.original)}>
              {tHistory("viewAction")}
            </Button>
            {row.original.status !== "PAID" ? (
              <Can I="finance.create">
                <Button size="sm" variant="secondary" onClick={() => onMakePayment(row.original)}>
                  {t("makePayment")}
                </Button>
              </Can>
            ) : null}
          </div>
        ),
      },
    ],
    [t, tHistory, purchaseById, expenseById, supplierById, onMakePayment, onViewHistory],
  );

  return (
    <div
      className="overflow-hidden rounded-2xl border border-border [&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted [&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground [&_tbody_td]:py-2"
    >
      <DataTable
        columns={columns}
        data={items}
        getRowId={(row) => row.id}
        isLoading={isLoading}
        isError={isError}
        onRetry={onRetry}
        emptyState={{ title: t("empty.title"), description: t("empty.description") }}
      />
    </div>
  );
}
