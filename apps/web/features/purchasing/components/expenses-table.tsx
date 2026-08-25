"use client";

import { useTranslations, useLocale } from "next-intl";
import { Receipt } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { useExpenses, usePayables } from "../hooks/use-purchasing";
import { PayableStatusBadge } from "./payable-status-badge";

export function ExpensesTable() {
  const t = useTranslations("purchasing.expensesTable");
  const tCategory = useTranslations("purchasing.recordExpense.categoryOptions");
  const locale = useLocale() as Locale;
  const { data: expenses, isLoading, isError, refetch } = useExpenses();
  const { data: payablesPage } = usePayables();

  if (isLoading) {
    return (
      <div className="flex flex-col gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (isError) {
    return <ErrorState title={t("errorTitle")} onRetry={() => void refetch()} />;
  }

  if (!expenses || expenses.length === 0) {
    return <EmptyState icon={Receipt} title={t("emptyTitle")} description={t("emptyDescription")} />;
  }

  const payableByExpenseId = new Map((payablesPage?.items ?? []).map((p) => [p.expenseId, p]));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("date")}</TableHead>
            <TableHead>{t("category")}</TableHead>
            <TableHead>{t("description")}</TableHead>
            <TableHead className="text-right">{t("amount")}</TableHead>
            <TableHead>{t("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {expenses.map((expense) => (
            <TableRow key={expense.id}>
              <TableCell>{formatDate(expense.expenseDate, locale)}</TableCell>
              <TableCell>{tCategory(expense.category)}</TableCell>
              <TableCell className="max-w-[240px] truncate">{expense.description}</TableCell>
              <TableCell className="text-right font-medium">{formatMoney(expense.amount, locale)}</TableCell>
              <TableCell>
                <PayableStatusBadge payable={payableByExpenseId.get(expense.id) ?? undefined} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
