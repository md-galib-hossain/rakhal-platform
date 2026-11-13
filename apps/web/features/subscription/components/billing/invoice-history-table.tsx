"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Badge, type BadgeProps } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useInvoices } from "../../hooks/use-billing";
import type { InvoiceStatus } from "../../types";

const STATUS_VARIANT: Record<InvoiceStatus, BadgeProps["variant"]> = {
  PAID: "success",
  REFUNDED: "info",
  PENDING: "warning",
  DRAFT: "secondary",
  FAILED: "destructive",
  VOID: "outline",
};

/** A receipt PDF only exists for a settled invoice. */
const DOWNLOADABLE = new Set<InvoiceStatus>(["PAID", "REFUNDED"]);

/**
 * Figma "Invoice History" table (node `1039:51263`). Reads the real cursor-paginated
 * `GET /billing/invoices` (`subscription.read`). Download links to the bespoke same-origin
 * `/api/billing/invoices/[id]/receipt` route (the binary PDF can't go through the JSON proxy);
 * only settled invoices are downloadable.
 */
export function InvoiceHistoryTable() {
  const t = useTranslations("billing");
  const { items, isLoading, isError, refetch, page, totalPages, goToPage } = useInvoices();

  return (
    <section className="flex flex-col gap-4">
      <h3 className="text-lg font-semibold text-foreground">{t("invoices.title")}</h3>
      <div className="overflow-hidden rounded-2xl border border-border bg-card">
        {isError ? (
          <ErrorState description={t("invoices.error")} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <div className="flex flex-col gap-2 p-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-12 animate-pulse rounded bg-muted" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState title={t("invoices.empty")} description={t("invoices.emptyDescription")} />
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("invoices.columns.date")}</TableHead>
                  <TableHead>{t("invoices.columns.amount")}</TableHead>
                  <TableHead>{t("invoices.columns.status")}</TableHead>
                  <TableHead className="text-right">{t("invoices.columns.action")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium text-foreground">
                      <DateText date={inv.paid_at ?? inv.created_at} />
                    </TableCell>
                    <TableCell>
                      <MoneyText amount={inv.total} />
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[inv.status]}>{t(`status.${inv.status}`)}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {DOWNLOADABLE.has(inv.status) ? (
                        <Button asChild variant="outline" size="sm" className="gap-1.5">
                          <a href={`/api/billing/invoices/${inv.id}/receipt`} download>
                            <Download className="size-4" aria-hidden />
                            {t("invoices.download")}
                          </a>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 ? (
              <div className="flex items-center justify-between gap-2 border-t border-border p-3">
                <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => goToPage(page - 1)}>
                  {t("invoices.prev")}
                </Button>
                <span className="text-xs text-muted-foreground">{t("invoices.page", { page })}</span>
                <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>
                  {t("invoices.next")}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
