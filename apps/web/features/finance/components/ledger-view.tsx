"use client"; // URL-synced segment state

import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { ArrowLeftRight, Package, Receipt, ShoppingCart } from "lucide-react";
import { cn } from "@/lib/utils";
import { LedgerSalesTable } from "./ledger-sales-table";
import { LedgerPurchasesTable } from "./ledger-purchases-table";
import { LedgerPaymentsTable } from "./ledger-payments-table";
import { LedgerTransfersTable } from "./ledger-transfers-table";

const SEGMENT_KEYS = ["sales", "purchases", "payments", "transfers"] as const;
type LedgerSegment = (typeof SEGMENT_KEYS)[number];

const SEGMENT_ICONS: Record<LedgerSegment, typeof Receipt> = {
  sales: ShoppingCart,
  purchases: Package,
  payments: Receipt,
  transfers: ArrowLeftRight,
};

/**
 * RAKHAL-360 — Ledger view, redesigned as a business-document list on Finance V2 endpoints.
 * Replaces V1's single flat `GET /finance/ledger` transaction table (`ledger-table.tsx`/
 * `ledger-columns.tsx`/`ledger-filters.tsx`/`ledger-performance-chart.tsx`/
 * `void-transaction-dialog.tsx` — left in place, unused from here, cleanup deferred to RAKHAL-354
 * which deletes V1 wholesale) with four segments, one per V2 document type: Sales, Purchases,
 * Payments, Transfers.
 *
 * **Critical constraint from `FINANCE_V2_DESIGN.md` §9 — enforced throughout this whole segment
 * set**: no ledger-account names, no "debit"/"credit" columns anywhere. Every table below shows
 * only plain business facts — what was sold/bought/paid/transferred, when, how much, to/from whom —
 * sourced from `Sale`/`Purchase`/`FinancePayment`/`Transfer`, never `LedgerAccount`/`JournalEntry`
 * (neither type is even imported into this feature's frontend code).
 *
 * A local `doc` URL param drives the segment, distinct from `FinanceTabs`' own `tab` param (this
 * lives one level inside the "ledger" tab) — same nuqs pattern `FinanceTabs`/`useActiveFinanceTab`
 * already use, just a second independent param.
 */
export function LedgerView() {
  const t = useTranslations("finance.ledgerV2");
  const [segment, setSegment] = useQueryState("doc", parseAsStringEnum<LedgerSegment>([...SEGMENT_KEYS]).withDefault("sales"));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1 rounded-lg border border-border bg-muted p-1.5">
        {SEGMENT_KEYS.map((key) => {
          const Icon = SEGMENT_ICONS[key];
          return (
            <button
              key={key}
              type="button"
              onClick={() => void setSegment(key)}
              className={cn(
                "flex items-center gap-1.5 rounded-sm px-4 py-1.5 text-sm font-medium transition-colors",
                segment === key ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-[16px]" aria-hidden />
              {t(`segments.${key}`)}
            </button>
          );
        })}
      </div>

      {segment === "sales" ? <LedgerSalesTable /> : null}
      {segment === "purchases" ? <LedgerPurchasesTable /> : null}
      {segment === "payments" ? <LedgerPaymentsTable /> : null}
      {segment === "transfers" ? <LedgerTransfersTable /> : null}
    </div>
  );
}
