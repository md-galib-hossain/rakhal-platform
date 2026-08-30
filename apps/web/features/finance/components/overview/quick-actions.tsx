"use client"; // dialog-open state + tab-switch

import { useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { parseAsStringEnum, useQueryState } from "nuqs";
import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { TransferFormSheet } from "../accounts/transfer-form-sheet";
import { FINANCE_TABS, type FinanceTabKey } from "../../types";

const TAB_KEYS = FINANCE_TABS.map((t) => t.key) as [FinanceTabKey, ...FinanceTabKey[]];

/**
 * RAKHAL-383 — Overview's Quick Actions, narrowed from RAKHAL-361's 6-button row to the 4 this
 * ticket's own AC names: **`Record Sale` and `Record Purchase`/`Other Income` are removed** — a
 * sale (incl. Other Income) originates in Sales, a purchase in Purchasing, per
 * `BUSINESS_IA_PRD.md` §5.1/§4.1. Two inline links below the buttons keep both destinations
 * discoverable from here instead of silently dropping the affordance.
 */
export function QuickActions() {
  const t = useTranslations("finance.overview.quickActions");
  const [, setTab] = useQueryState("tab", parseAsStringEnum<FinanceTabKey>(TAB_KEYS).withDefault("overview"));
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <Link href="/purchasing">
            <Receipt className="size-4" aria-hidden />
            {t("recordExpense")}
          </Link>
        </Button>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void setTab("receivables")}>
          <ArrowDownToLine className="size-4" aria-hidden />
          {t("receivePayment")}
        </Button>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void setTab("payables")}>
          <ArrowUpFromLine className="size-4" aria-hidden />
          {t("makePayment")}
        </Button>

        <Can
          I="finance.transfer"
          fallback={
            <Button variant="outline" size="sm" className="gap-1.5" disabled title={t("transferOwnerOnlyTooltip")}>
              <ArrowLeftRight className="size-4" aria-hidden />
              {t("transferMoney")}
            </Button>
          }
        >
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight className="size-4" aria-hidden />
            {t("transferMoney")}
          </Button>
        </Can>
        <TransferFormSheet open={transferOpen} onOpenChange={setTransferOpen} />
      </div>

      <p className="text-xs text-muted-foreground">
        {t("recordSaleHint")} <Link href="/sales" className="font-medium text-primary hover:underline">{t("goToSales")}</Link>
        {" · "}
        {t("recordPurchaseHint")} <Link href="/purchasing" className="font-medium text-primary hover:underline">{t("goToPurchasing")}</Link>
      </p>

      <p className="text-xs text-muted-foreground">{t("transferCopy")}</p>
    </div>
  );
}
