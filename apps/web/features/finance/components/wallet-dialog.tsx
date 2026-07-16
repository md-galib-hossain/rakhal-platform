"use client"; // live query + sub-dialog navigation

import { useTranslations } from "next-intl";
import { ArrowRightToLine, CircleArrowDown, CircleArrowUp, Clock, Plus, Wallet as WalletIcon } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { Button } from "@/components/ui/button";
import { SheetContent, SheetTitle } from "@/components/ui/sheet";
import { useWallet } from "../hooks/use-finance";
import type { WalletTransactionItem } from "../types";

/**
 * "Wallet" hub — Figma `1039:25473` (file `SCfMPdxP6vgW1uTxfqCtz7`): Total Balance + Add Funds/
 * Withdraw entry buttons + "Recent Transactions" list, backed by the real `GET /finance/wallet`
 * (`finance.service.ts#wallet` — last 50 `WalletTransaction` rows, newest first). The mock's
 * decorative "Safety Vault" background illustration is dropped (pure visual flourish, not part of
 * the data). Real gap, flagged not faked: the mock's "View All" button has no matching endpoint —
 * `wallet()` always returns the same last-50 window with no cursor/offset param — so it's omitted
 * rather than wired to nothing.
 *
 * No `<Sheet>` wrapper here on purpose — this, `AddFundsDialogContent`, and `WithdrawDialogContent`
 * all share ONE `<Sheet>` owned by `FinanceHeaderActions`. Giving each step its own separate `Sheet`
 * caused a real bug: Radix's outside-pointerdown-close detector on a newly-mounted `Sheet` fires
 * against the same click that just closed the previous one (its content isn't in the DOM yet at
 * pointerdown), so switching "Wallet" → "Add Funds" silently closed both instead of navigating.
 */
export function WalletDialogContent({
  onClose,
  onAddFunds,
  onWithdraw,
}: {
  onClose: () => void;
  onAddFunds: () => void;
  onWithdraw: () => void;
}) {
  const t = useTranslations("finance.wallet");
  const query = useWallet();

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[560px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[560px]"
    >
      <div className="flex items-center justify-between pb-5">
        <div className="flex items-center gap-1.5">
          <WalletIcon className="size-6 text-foreground" aria-hidden />
          <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto py-5">
        {query.isLoading ? (
          <CardSkeleton lines={4} />
        ) : query.isError ? (
          <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
        ) : (
          <>
            <div className="flex flex-col gap-1 rounded-2xl bg-primary/10 p-4">
              <p className="text-sm font-medium text-foreground">{t("totalBalance")}</p>
              <p className="text-3xl font-bold text-foreground">
                <MoneyText amount={query.data?.totalBalance ?? 0} />
              </p>
            </div>

            <div className="flex gap-2">
              <Button type="button" className="h-12 flex-1 gap-1.5 rounded-xl" onClick={onAddFunds}>
                <Plus className="size-[18px]" aria-hidden />
                {t("addFunds")}
              </Button>
              <Button type="button" variant="secondary" className="h-12 flex-1 gap-1.5 rounded-xl" onClick={onWithdraw}>
                <CircleArrowDown className="size-[18px]" aria-hidden />
                {t("withdraw")}
              </Button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Clock className="size-[18px] text-foreground" aria-hidden />
                <p className="text-base font-medium text-foreground">{t("recentTransactions")}</p>
              </div>

              {(query.data?.transactions.length ?? 0) === 0 ? (
                <EmptyState title={t("empty.title")} description={t("empty.description")} />
              ) : (
                <div className="flex flex-col gap-2">
                  {query.data?.transactions.map((txn) => (
                    <WalletTransactionRow key={txn.id} txn={txn} />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </SheetContent>
  );
}

function WalletTransactionRow({ txn }: { txn: WalletTransactionItem }) {
  const t = useTranslations("finance.wallet");
  const isCredit = txn.type === "credit";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border p-3">
      <span className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${isCredit ? "bg-success-tint text-success" : "bg-destructive-tint text-destructive"}`}>
        {isCredit ? <CircleArrowUp className="size-5" aria-hidden /> : <CircleArrowDown className="size-5" aria-hidden />}
      </span>
      <div className="flex flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium text-foreground">{txn.description || t("noDescription")}</p>
          <p className={`text-sm font-bold ${isCredit ? "text-success" : "text-destructive"}`}>
            {isCredit ? "+" : "-"}
            <MoneyText amount={txn.amount} />
          </p>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">{txn.reference}</p>
          <DateText date={txn.date} className="text-xs text-muted-foreground" />
        </div>
      </div>
    </div>
  );
}
