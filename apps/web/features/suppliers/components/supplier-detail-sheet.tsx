"use client"; // recent-purchases query + pay dialog state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightToLine, Banknote, Pencil, Plus } from "lucide-react";
import { Badge } from "@rakhal/ui/ui/badge";
import { Button } from "@rakhal/ui/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DateText } from "@/components/shared/date-text";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { Can } from "@/lib/auth/permissions";
import { PurchasePayDialog } from "@/features/purchasing/components/purchase-pay-dialog";
import { useSupplierPurchases } from "@/features/purchasing/hooks/use-purchasing";
import type { PurchaseListRow } from "@/features/purchasing/types";
import type { SupplierRow } from "../types";

/**
 * Supplier detail — opened by clicking a Suppliers row. Totals and the outstanding balance come from
 * the aggregate row (`GET /purchasing/suppliers`, never recomputed here); the five newest purchases are
 * loaded on open (`GET /purchasing/purchases?supplierId=`) and each one that still owes money has its
 * own **Pay** (`MakePaymentDialog`, `finance.create`). **Record purchase** (`purchasing.create`) hands
 * the supplier to the parent, which opens Record Purchase with this supplier pre-selected.
 */
export function SupplierDetailSheet({
  supplier,
  open,
  onOpenChange,
  onRecordPurchase,
  onEdit,
}: {
  supplier: SupplierRow | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRecordPurchase: (supplier: SupplierRow) => void;
  onEdit: (supplier: SupplierRow) => void;
}) {
  const t = useTranslations("suppliers.detailSheet");
  const tStatus = useTranslations("purchasing.purchasesTable");
  const purchases = useSupplierPurchases(open ? supplier?.id : undefined);
  const [payTarget, setPayTarget] = useState<PurchaseListRow | null>(null);

  const rows = purchases.data?.items ?? [];
  const payable = supplier ? Number(supplier.payable) : 0;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="right"
          showClose={false}
          className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-lg sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
        >
          <div className="flex items-center justify-between pb-5">
            <SheetTitle className="text-xl font-bold text-foreground">{supplier?.name ?? t("title")}</SheetTitle>
            <button type="button" onClick={() => onOpenChange(false)} aria-label={t("close")} className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70">
              <ArrowRightToLine className="size-5" aria-hidden />
            </button>
          </div>
          <SheetDescription className="sr-only">{t("description")}</SheetDescription>
          <div className="border-t border-dashed border-border" />

          {supplier ? (
            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {supplier.status === "INACTIVE" ? <Badge variant="outline">{t("inactive")}</Badge> : null}
                <span>{supplier.phone ?? t("noPhone")}</span>
              </div>

              <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4 text-sm">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t("totalPurchases")}</dt>
                  <dd>
                    <MoneyText amount={Number(supplier.totalPurchases)} className="font-semibold" />
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t("outstanding")}</dt>
                  <dd>
                    <MoneyText amount={payable} colorize={payable > 0} className="font-semibold" />
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted-foreground">{t("lastPurchase")}</dt>
                  <dd>{supplier.lastPurchaseAt ? <DateText date={supplier.lastPurchaseAt} /> : "—"}</dd>
                </div>
              </dl>

              <section className="flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-foreground">{t("recentPurchases")}</h3>
                {purchases.isError ? (
                  <ErrorState description={t("loadError")} onRetry={() => void purchases.refetch()} />
                ) : purchases.isLoading ? (
                  <p className="text-sm text-muted-foreground">{t("loading")}</p>
                ) : rows.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{t("noPurchases")}</p>
                ) : (
                  <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                    {rows.map((row) => (
                      <div key={row.id} className="flex items-center justify-between gap-3 p-3">
                        <div className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-mono text-xs text-foreground">{row.purchaseNumber}</span>
                          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <DateText date={row.purchaseDate} />
                            {row.status === "VOIDED" ? <Badge variant="destructive">{tStatus("voided")}</Badge> : null}
                            {row.paymentStatus && row.paymentStatus !== "PAID" ? <span>{tStatus(`statusOptions.${row.paymentStatus}`)}</span> : null}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="flex flex-col items-end">
                            <MoneyText amount={Number(row.totalAmount)} className="text-sm font-medium" />
                            {Number(row.outstanding) > 0 ? (
                              <span className="text-xs text-destructive">
                                {t("owed")}: <MoneyText amount={Number(row.outstanding)} className="inline" />
                              </span>
                            ) : null}
                          </div>
                          {row.status !== "VOIDED" && Number(row.outstanding) > 0 ? (
                            <Can I="finance.create">
                              <Button size="sm" variant="secondary" onClick={() => setPayTarget(row)}>
                                <Banknote className="mr-1 size-3.5" aria-hidden />
                                {t("pay")}
                              </Button>
                            </Can>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          ) : null}

          {supplier ? (
            <>
              <div className="border-t border-dashed border-border" />
              <div className="flex gap-3 pt-5">
                <Can I="settings.update">
                  <Button type="button" variant="outline" className="h-12 flex-1" onClick={() => onEdit(supplier)}>
                    <Pencil className="mr-1.5 size-4" aria-hidden />
                    {t("edit")}
                  </Button>
                </Can>
                {supplier.status === "ACTIVE" ? (
                  <Can I="purchasing.create">
                    <Button type="button" className="h-12 flex-1" onClick={() => onRecordPurchase(supplier)}>
                      <Plus className="mr-1.5 size-4" aria-hidden />
                      {t("recordPurchase")}
                    </Button>
                  </Can>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      <PurchasePayDialog purchase={payTarget} open={payTarget !== null} onOpenChange={(next) => !next && setPayTarget(null)} />
    </>
  );
}
