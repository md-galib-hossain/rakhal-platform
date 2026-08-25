"use client";

import { useTranslations, useLocale } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { Skeleton } from "@/components/ui/skeleton";
import { formatDate, formatMoney } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { usePayables, usePurchases } from "../hooks/use-purchasing";
import { PayableStatusBadge } from "./payable-status-badge";

export function PurchasesTable() {
  const t = useTranslations("purchasing.purchasesTable");
  const locale = useLocale() as Locale;
  const { data: purchases, isLoading, isError, refetch } = usePurchases();
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

  if (!purchases || purchases.length === 0) {
    return (
      <EmptyState
        icon={ShoppingCart}
        title={t("emptyTitle")}
        description={t("emptyDescription")}
      />
    );
  }

  const payableByPurchaseId = new Map((payablesPage?.items ?? []).map((p) => [p.purchaseId, p]));

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{t("number")}</TableHead>
            <TableHead>{t("date")}</TableHead>
            <TableHead>{t("supplier")}</TableHead>
            <TableHead className="text-right">{t("total")}</TableHead>
            <TableHead>{t("status")}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {purchases.map((purchase) => (
            <TableRow key={purchase.id}>
              <TableCell className="font-mono text-xs">{purchase.purchaseNumber}</TableCell>
              <TableCell>{formatDate(purchase.purchaseDate, locale)}</TableCell>
              <TableCell>{purchase.supplierId || t("noSupplier")}</TableCell>
              <TableCell className="text-right font-medium">{formatMoney(purchase.totalAmount, locale)}</TableCell>
              <TableCell>
                <PayableStatusBadge payable={payableByPurchaseId.get(purchase.id) ?? undefined} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
