"use client"; // detail query + payment-history fan-out + sheet state

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ArrowRightToLine, Banknote, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { DateText } from "@/components/shared/date-text";
import { ErrorState } from "@/components/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { Can } from "@/lib/auth/permissions";
import { inventoryApi } from "@/features/inventory/api";
import { useFinancialAccounts, usePaymentHistory } from "@/features/finance/hooks/use-finance-v2";
import { usePurchase } from "../hooks/use-purchasing";
import type { PayableStatus, PurchaseLine, PurchaseListRow } from "../types";

const VARIANT_BY_STATUS: Record<PayableStatus, "warning" | "success" | "destructive"> = {
  UNPAID: "warning",
  PARTIALLY_PAID: "warning",
  PAID: "success",
  OVERDUE: "destructive",
};

type LineKind = "MEDICINE" | "FEED_ITEM" | "EQUIPMENT";

function lineTarget(line: PurchaseLine): { kind: LineKind; id: string } | null {
  if (line.medicineId) return { kind: "MEDICINE", id: line.medicineId };
  if (line.feedItemId) return { kind: "FEED_ITEM", id: line.feedItemId };
  if (line.equipmentId) return { kind: "EQUIPMENT", id: line.equipmentId };
  return null;
}

const INVENTORY_TAB: Record<LineKind, string> = { MEDICINE: "medicine", FEED_ITEM: "feed", EQUIPMENT: "others" };

/** The line stores only an item id — fetch the item for its name + unit. Cached per id, so reopening a
 * purchase (or two lines of one item) costs nothing. */
function useLineItem(target: { kind: LineKind; id: string } | null) {
  return useQuery({
    queryKey: ["purchasing", "v2", "line-item", target?.kind, target?.id],
    enabled: target != null,
    staleTime: 60_000,
    queryFn: async () => {
      if (!target) return null;
      if (target.kind === "MEDICINE") {
        const m = await inventoryApi.findMedicine(target.id);
        return { name: m.name, unit: m.unit.symbol };
      }
      if (target.kind === "FEED_ITEM") {
        const f = await inventoryApi.findFeedItem(target.id);
        return { name: f.name, unit: f.unit.symbol };
      }
      const e = await inventoryApi.findEquipment(target.id);
      return { name: e.name, unit: e.unit?.symbol ?? "" };
    },
  });
}

function LineRow({ line }: { line: PurchaseLine }) {
  const t = useTranslations("purchasing.detailSheet");
  const target = lineTarget(line);
  const item = useLineItem(target);
  const label = item.data?.name ?? (item.isLoading ? t("loadingItem") : t("unknownItem"));
  return (
    <div className="flex items-start justify-between gap-3 p-3">
      <div className="flex min-w-0 flex-col gap-0.5">
        {target ? (
          <Link href={`/inventory?tab=${INVENTORY_TAB[target.kind]}`} className="truncate text-sm font-medium text-primary hover:underline">
            {label}
          </Link>
        ) : (
          <span className="truncate text-sm font-medium text-foreground">{label}</span>
        )}
        <span className="text-xs text-muted-foreground">
          {Number(line.quantity)} {item.data?.unit ?? ""} × <MoneyText amount={Number(line.unitCost)} className="inline" />
        </span>
      </div>
      <MoneyText amount={Number(line.totalAmount)} className="shrink-0 text-sm font-medium" />
    </div>
  );
}

/**
 * Purchase detail — opened by clicking a Purchases row. Shows what was bought (lines, each linking to
 * its Inventory tab), what was paid and when (the payable's payment history, oldest first), the
 * server-derived paid / outstanding / status, and the actions that belong to a document: **Pay**
 * (`finance.create`, while something is owed) and **Void** (`finance.reverse`, refused server-side if a
 * payment is allocated). Cross-links go to Inventory (per line), Finance and the Activity Log.
 */
export function PurchaseDetailSheet({
  purchase,
  supplierName,
  open,
  onOpenChange,
  onPay,
  onVoid,
}: {
  purchase: PurchaseListRow | null;
  supplierName?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPay: (purchase: PurchaseListRow) => void;
  onVoid: (purchase: PurchaseListRow) => void;
}) {
  const t = useTranslations("purchasing.detailSheet");
  const tStatus = useTranslations("purchasing.purchasesTable");
  const tMethods = useTranslations("finance.settlementsV2.methodOptions");
  const detail = usePurchase(open ? purchase?.id : undefined);
  const payableId = detail.data?.payable?.id;
  // `usePaymentHistory` has no per-document endpoint behind it: it loads every payment, then each one's
  // allocations (one request each). Run it only when the user asks, never just by opening the sheet.
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const wantHistory = open && purchase != null && historyFor === purchase.id;
  const history = usePaymentHistory("PAYABLE", wantHistory ? payableId : undefined);
  const { data: accounts } = useFinancialAccounts();
  const accountName = new Map((accounts ?? []).map((a) => [a.id, a.name]));

  const voided = purchase?.status === "VOIDED";
  const outstanding = purchase ? Number(purchase.outstanding) : 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showClose={false}
        className="inset-y-0 right-0 flex h-full w-full flex-col gap-0 border-0 p-4 shadow-2xl sm:inset-y-2.5 sm:right-2.5 sm:h-[calc(100vh-20px)] sm:w-[calc(100%-20px)] sm:max-w-lg sm:rounded-[20px] sm:border-2 sm:border-border sm:p-5"
      >
        <div className="flex items-center justify-between pb-5">
          <SheetTitle className="text-xl font-bold text-foreground">{purchase?.purchaseNumber ?? t("title")}</SheetTitle>
          <button type="button" onClick={() => onOpenChange(false)} aria-label={t("close")} className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70">
            <ArrowRightToLine className="size-5" aria-hidden />
          </button>
        </div>
        <SheetDescription className="sr-only">{t("description")}</SheetDescription>
        <div className="border-t border-dashed border-border" />

        {purchase ? (
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-1 py-4">
            <div className="flex flex-wrap items-center gap-1.5">
              {purchase.paymentStatus ? (
                <Badge variant={VARIANT_BY_STATUS[purchase.paymentStatus]}>{tStatus(`statusOptions.${purchase.paymentStatus}`)}</Badge>
              ) : null}
              {voided ? <Badge variant="destructive">{tStatus("voided")}</Badge> : null}
            </div>

            <dl className="grid grid-cols-2 gap-3 rounded-xl border border-border p-4 text-sm">
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("supplier")}</dt>
                <dd className="text-foreground">{supplierName ?? "—"}</dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("date")}</dt>
                <dd>
                  <DateText date={purchase.purchaseDate} />
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("total")}</dt>
                <dd>
                  <MoneyText amount={Number(purchase.totalAmount)} className="font-semibold" />
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("paid")}</dt>
                <dd>
                  <MoneyText amount={Number(purchase.paidAmount)} />
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("outstanding")}</dt>
                <dd>
                  <MoneyText amount={outstanding} colorize={outstanding > 0} />
                </dd>
              </div>
              <div className="flex flex-col gap-0.5">
                <dt className="text-xs text-muted-foreground">{t("dueDate")}</dt>
                <dd>{detail.data?.payable?.dueDate ? <DateText date={detail.data.payable.dueDate} /> : "—"}</dd>
              </div>
            </dl>

            {purchase.notes ? <p className="rounded-xl bg-muted px-4 py-3 text-sm text-muted-foreground">{purchase.notes}</p> : null}

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">{t("lines")}</h3>
              {detail.isError ? (
                <ErrorState description={t("loadError")} onRetry={() => void detail.refetch()} />
              ) : detail.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("loading")}</p>
              ) : (
                <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                  {(detail.data?.lines ?? []).map((line) => (
                    <LineRow key={line.id} line={line} />
                  ))}
                </div>
              )}
            </section>

            <section className="flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-foreground">{t("payments")}</h3>
              {!payableId ? (
                <p className="text-sm text-muted-foreground">{detail.isLoading ? t("loading") : t("paidAtCreation")}</p>
              ) : !wantHistory ? (
                <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => setHistoryFor(purchase.id)}>
                  {t("showPayments")}
                </Button>
              ) : history.isLoading ? (
                <p className="text-sm text-muted-foreground">{t("loading")}</p>
              ) : history.rows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noPayments")}</p>
              ) : (
                <div className="flex flex-col divide-y divide-border rounded-xl border border-border">
                  {history.rows.map((row) => (
                    <div key={`${row.paymentId}-${row.amount}`} className="flex items-center justify-between gap-3 p-3">
                      <div className="flex flex-col gap-0.5">
                        <DateText date={row.transactionDate} className="text-sm text-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {accountName.get(row.financialAccountId) ?? ""} {tMethods(row.method)}
                          {row.referenceNumber ? ` · ${row.referenceNumber}` : ""}
                        </span>
                      </div>
                      <MoneyText amount={row.amount} className="text-sm font-medium" />
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="flex flex-wrap gap-3 text-sm">
              <Link href="/finance?tab=payables" className="font-medium text-primary hover:underline">
                {t("viewFinance")}
              </Link>
              <Link href="/activity" className="font-medium text-primary hover:underline">
                {t("viewActivity")}
              </Link>
            </div>
          </div>
        ) : null}

        {purchase && !voided ? (
          <>
            <div className="border-t border-dashed border-border" />
            <div className="flex gap-3 pt-5">
              <Can I="finance.reverse">
                <Button type="button" variant="outline" className="h-12 flex-1 text-destructive hover:text-destructive" onClick={() => onVoid(purchase)}>
                  <Ban className="mr-1.5 size-4" aria-hidden />
                  {t("void")}
                </Button>
              </Can>
              {outstanding > 0 ? (
                <Can I="finance.create">
                  <Button type="button" className="h-12 flex-1" onClick={() => onPay(purchase)}>
                    <Banknote className="mr-1.5 size-4" aria-hidden />
                    {t("pay")}
                  </Button>
                </Can>
              ) : null}
            </div>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
