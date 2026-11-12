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
import { usePayables, useExpensesList, useVoidExpense } from "../hooks/use-purchasing";
import type { Expense, ExpensesListFilters, PayableStatus } from "../types";

const VARIANT_BY_STATUS: Record<PayableStatus, "warning" | "success" | "destructive"> = {
  UNPAID: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "destructive",
};

/** RAKHAL-391/392 (MILESTONE 22) — Expenses tab, same cursor "load more" + `Payable` cross-reference
 * shape `PurchasesTable` uses. Columns: `Category | Description | Date | Amount | Status | Due Date`
 * — no `Reference`/`Paid Amount` split, since an `Expense` is either fully paid at creation or raises
 * its full amount as a `Payable` (`RecordExpenseDto`'s own doc comment — no partial-expense field
 * exists server-side, unlike `Purchase`), so a separate "Paid Amount" column would just repeat
 * `Amount` or `0`. RAKHAL-392 adds a `Voided` badge (`Expense.voidedAt != null` — no `status` enum
 * exists here, unlike `Purchase`) and a `Void` row action (`POST /purchasing/expenses/:id/void`,
 * `finance.reverse`-gated). */
export function ExpensesTable({ filters }: { filters: ExpensesListFilters }) {
  const t = useTranslations("purchasing.expensesTable");
  const tCategory = useTranslations("purchasing.recordExpense.categoryOptions");
  const query = useExpensesList(filters);
  const { data: payablesPage } = usePayables();
  const voidExpense = useVoidExpense();
  const [voidTarget, setVoidTarget] = useState<Expense | null>(null);

  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const payableByExpenseId = useMemo(
    () => new Map((payablesPage?.items ?? []).map((p) => [p.expenseId, p])),
    [payablesPage],
  );

  const columns = useMemo<ColumnDef<Expense, unknown>[]>(
    () => [
      {
        id: "category",
        header: t("category"),
        cell: ({ row }) => tCategory(row.original.category),
      },
      {
        id: "description",
        header: t("description"),
        cell: ({ row }) => <span className="max-w-[240px] truncate">{row.original.description}</span>,
      },
      {
        id: "date",
        header: t("date"),
        cell: ({ row }) => <DateText date={row.original.expenseDate} />,
      },
      {
        id: "amount",
        header: t("amount"),
        cell: ({ row }) => <MoneyText amount={Number(row.original.amount)} className="font-medium" />,
      },
      {
        id: "status",
        header: t("status"),
        cell: ({ row }) => {
          const payable = payableByExpenseId.get(row.original.id);
          return (
            <div className="flex items-center gap-1.5">
              {!payable ? (
                <Badge variant="success">{t("paidInFull")}</Badge>
              ) : (
                <Badge variant={VARIANT_BY_STATUS[payable.status]}>{t(`statusOptions.${payable.status}`)}</Badge>
              )}
              {row.original.voidedAt ? <Badge variant="destructive">{t("voided")}</Badge> : null}
            </div>
          );
        },
      },
      {
        id: "dueDate",
        header: t("dueDate"),
        cell: ({ row }) => {
          const payable = payableByExpenseId.get(row.original.id);
          return payable?.dueDate ? <DateText date={payable.dueDate} /> : <span className="text-muted-foreground">—</span>;
        },
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          row.original.voidedAt ? null : (
            <Can I="finance.reverse">
              <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setVoidTarget(row.original)}>
                {t("void")}
              </Button>
            </Can>
          ),
      },
    ],
    [t, tCategory, payableByExpenseId],
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
        documentLabel={voidTarget?.description ?? ""}
        onConfirm={() => voidExpense.mutateAsync(voidTarget!.id)}
      />
    </>
  );
}
