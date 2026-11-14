"use client"; // dialog state + mutations

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@rakhal/ui/ui/button";
import { Card } from "@rakhal/ui/ui/card";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { MoneyInput } from "@/components/shared/money-input";
import { MoneyText } from "@/components/shared/money-text";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@rakhal/ui/ui/dialog";
import { Can } from "@/lib/auth/permissions";
import { useFarmAccount, useRakhalBalance, useSetOpeningBalance } from "../../hooks/use-finance-v2";
import { AccountFormSheet } from "./account-form-sheet";

/**
 * One finance account per farm: this is that account. Opening the page resolves it through
 * `GET /finance/accounts/farm-account` (created as "Main Wallet" on first use), so there is no
 * empty state and no "add account". The farmer can rename it and set / correct its opening balance
 * (`PATCH /finance/accounts/:id/opening-balance`, which reverses + reposts the opening posting).
 */
export function AccountCard() {
  const t = useTranslations("finance.accountsPage.card");
  const accountQuery = useFarmAccount();
  const balanceQuery = useRakhalBalance();
  const [renameOpen, setRenameOpen] = useState(false);
  const [openingOpen, setOpeningOpen] = useState(false);

  if (accountQuery.isLoading) return <CardSkeleton lines={3} className="rounded-2xl" />;
  if (accountQuery.isError || !accountQuery.data) {
    return (
      <Card className="rounded-2xl p-4">
        <ErrorState description={t("error")} onRetry={() => void accountQuery.refetch()} />
      </Card>
    );
  }
  const account = accountQuery.data;
  const balance = balanceQuery.data?.accounts.find((a) => a.id === account.id)?.balance;

  return (
    <Card className="flex flex-col gap-4 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-info-tint text-info shadow-xs">
          <Wallet className="size-5" aria-hidden />
        </span>
        <div className="flex flex-col">
          <p className="text-base font-medium text-foreground">{account.name}</p>
          <p className="text-sm text-muted-foreground">
            {t("balanceLabel")}: {balance != null ? <MoneyText amount={Number(balance)} /> : "—"}
          </p>
        </div>
      </div>
      <Can I="finance.accounts">
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" size="sm" className="gap-1.5" onClick={() => setRenameOpen(true)}>
            <Pencil className="size-3.5" aria-hidden />
            {t("rename")}
          </Button>
          <Button size="sm" onClick={() => setOpeningOpen(true)}>
            {t("setOpening")}
          </Button>
        </div>
      </Can>

      <AccountFormSheet open={renameOpen} onOpenChange={setRenameOpen} account={account} />
      {openingOpen ? <OpeningBalanceDialog accountId={account.id} onOpenChange={setOpeningOpen} /> : null}
    </Card>
  );
}

function OpeningBalanceDialog({ accountId, onOpenChange }: { accountId: string; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("finance.accountsPage.card");
  const setOpening = useSetOpeningBalance();
  const [value, setValue] = useState<number | undefined>(undefined);

  async function save() {
    try {
      await setOpening.mutateAsync({ id: accountId, openingBalance: value ?? 0 });
      toast.success(t("openingSaved"));
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("openingError"));
    }
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("openingTitle")}</DialogTitle>
          <DialogDescription>{t("openingHelp")}</DialogDescription>
        </DialogHeader>
        <MoneyInput id="opening-balance" label={t("openingLabel")} value={value} onChange={setValue} />
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={setOpening.isPending}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={setOpening.isPending || value == null}>
            {setOpening.isPending ? "…" : t("save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
