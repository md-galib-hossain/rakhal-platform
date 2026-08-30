"use client"; // dialog-open state + tab-switch

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ChevronDown, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Can } from "@/lib/auth/permissions";
import { TransferFormSheet } from "../accounts/transfer-form-sheet";
import { FINANCE_TABS, type FinanceTabKey } from "../../types";

const TAB_KEYS = FINANCE_TABS.map((t) => t.key) as [FinanceTabKey, ...FinanceTabKey[]];

/** RAKHAL-385 — `+ New Transaction ▾` per the mockup's single-button affordance (§5.3). Same 4
 * destinations `overview/quick-actions.tsx` (RAKHAL-383) already established — a transaction can
 * only ever originate from Sales/Purchasing (record) or from settling a Receivable/Payable/
 * transferring money (this screen's own tabs), never created directly here (journal immutability,
 * ADR-023) — folded into one dropdown instead of a button row since this screen already has two
 * filter `Select`s competing for header space. */
export function NewTransactionMenu() {
  const t = useTranslations("finance.overview.quickActions");
  const [, setTab] = useQueryState("tab", parseAsStringEnum<FinanceTabKey>(TAB_KEYS).withDefault("overview"));
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" className="gap-1.5">
            {t("newTransaction")}
            <ChevronDown className="size-4" aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem asChild>
            <Link href="/purchasing">
              <Receipt className="mr-2 size-3.5" aria-hidden />
              {t("recordExpense")}
            </Link>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void setTab("receivables")}>
            <ArrowDownToLine className="mr-2 size-3.5" aria-hidden />
            {t("receivePayment")}
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => void setTab("payables")}>
            <ArrowUpFromLine className="mr-2 size-3.5" aria-hidden />
            {t("makePayment")}
          </DropdownMenuItem>
          <Can I="finance.transfer">
            <DropdownMenuItem onSelect={() => setTransferOpen(true)}>
              <ArrowLeftRight className="mr-2 size-3.5" aria-hidden />
              {t("transferMoney")}
            </DropdownMenuItem>
          </Can>
        </DropdownMenuContent>
      </DropdownMenu>
      <TransferFormSheet open={transferOpen} onOpenChange={setTransferOpen} />
    </>
  );
}
