"use client"; // dialog-open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Plus, Wallet as WalletIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet } from "@/components/ui/sheet";
import { WalletDialogContent } from "./wallet-dialog";
import { AddFundsDialogContent } from "./add-funds-dialog";
import { WithdrawDialogContent } from "./withdraw-dialog";
import { RecordTransactionDialog } from "./record-transaction-dialog";
import { ReportExportButton } from "@/features/reports/components/report-export-button";
import { FINANCE_EXPORT_REPORT } from "@/features/reports/report-defs";

type WalletFlow = "none" | "wallet" | "addFunds" | "withdraw";

/**
 * Finance page header's "Wallet"/"Record" buttons + the dialogs they open. The Wallet hub and its
 * Add Funds/Withdraw steps all share ONE `<Sheet>` (see `wallet-dialog.tsx`'s doc comment for why
 * three separate `Sheet`s broke step navigation) — `walletFlow` picks which step's content renders
 * inside it. The Record wizard is unrelated (its own 3-step `<Sheet>` internally) and stays a
 * separate top-level dialog. Both live in the `PageCard` header `actions` slot — a `Sheet`'s content
 * renders in a portal, so where this component sits in the tree doesn't affect where the dialogs
 * visually appear.
 */
export function FinanceHeaderActions() {
  const t = useTranslations("finance.actions");
  const [walletFlow, setWalletFlow] = useState<WalletFlow>("none");
  const [recordOpen, setRecordOpen] = useState(false);

  return (
    <>
      <div className="flex items-center gap-2">
        <ReportExportButton report={FINANCE_EXPORT_REPORT} variant="secondary" />
        <Button variant="secondary" className="gap-2" onClick={() => setWalletFlow("wallet")}>
          <WalletIcon className="size-[18px]" aria-hidden />
          {t("wallet")}
        </Button>
        <Button variant="primary" className="gap-2" onClick={() => setRecordOpen(true)}>
          <Plus className="size-[18px]" aria-hidden />
          {t("record")}
        </Button>
      </div>

      <Sheet open={walletFlow !== "none"} onOpenChange={(open) => setWalletFlow(open ? "wallet" : "none")}>
        {walletFlow === "wallet" ? (
          <WalletDialogContent onClose={() => setWalletFlow("none")} onAddFunds={() => setWalletFlow("addFunds")} onWithdraw={() => setWalletFlow("withdraw")} />
        ) : walletFlow === "addFunds" ? (
          <AddFundsDialogContent onBack={() => setWalletFlow("wallet")} />
        ) : walletFlow === "withdraw" ? (
          <WithdrawDialogContent onBack={() => setWalletFlow("wallet")} />
        ) : null}
      </Sheet>

      <RecordTransactionDialog open={recordOpen} onOpenChange={setRecordOpen} />
    </>
  );
}
