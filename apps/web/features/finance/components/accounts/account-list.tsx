"use client"; // list query + row action state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Landmark, MoreVertical, Pencil, Plus, Smartphone, Wallet } from "lucide-react";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { Can } from "@/lib/auth/permissions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useFinancialAccounts } from "../../hooks/use-finance-v2";
import { AccountFormSheet } from "./account-form-sheet";
import { ArchiveAccountDialog } from "./archive-account-dialog";
import type { FinancialAccount, FinancialAccountType } from "../../types-v2";

const TYPE_ICON: Record<FinancialAccountType, typeof Wallet> = {
  CASH: Wallet,
  BANK: Landmark,
  MFS: Smartphone,
};

/**
 * RAKHAL-356 — Account list/grid: create/edit/archive, gated by `finance.accounts` (Owner+Manager,
 * not Worker — confirmed against the live `permission-catalogue.ts`). No `balance` shown per account
 * here (the model has none, per `types-v2.ts`'s doc comment) — `RakhalBalanceCard` above this list is
 * where a per-account balance appears, sourced from `GET /finance/balance` instead.
 */
export function AccountList() {
  const t = useTranslations("finance.accountsPage.list");
  const query = useFinancialAccounts();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialAccount | undefined>(undefined);
  const [archiving, setArchiving] = useState<FinancialAccount | null>(null);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }
  function openEdit(account: FinancialAccount) {
    setEditing(account);
    setFormOpen(true);
  }

  return (
    <Card className="flex flex-col gap-4 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-medium text-foreground">{t("title")}</p>
        <Can I="finance.accounts">
          <Button size="sm" className="gap-1.5" onClick={openCreate}>
            <Plus className="size-4" aria-hidden />
            {t("addAccount")}
          </Button>
        </Can>
      </div>

      {query.isLoading ? (
        <CardSkeleton lines={3} />
      ) : query.isError ? (
        <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
      ) : (query.data ?? []).length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={t("empty.title")}
          description={t("empty.description")}
          action={
            <Can I="finance.accounts">
              <Button size="sm" className="gap-1.5" onClick={openCreate}>
                <Plus className="size-4" aria-hidden />
                {t("addAccount")}
              </Button>
            </Can>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(query.data ?? []).map((account) => {
            const Icon = TYPE_ICON[account.type];
            return (
              <div key={account.id} className="flex items-start justify-between gap-2 rounded-xl border border-border p-3">
                <div className="flex items-start gap-2.5">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-info-tint text-info shadow-xs">
                    <Icon className="size-4" aria-hidden />
                  </span>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-sm font-medium text-foreground">{account.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {account.type === "BANK" && account.bankDetail
                        ? `${account.bankDetail.bankName} · ${account.bankDetail.accountNumber}`
                        : account.type === "MFS" && account.mfsDetail
                          ? `${t(`typeOptions.${account.mfsDetail.provider}`)} · ${account.mfsDetail.phoneNumber}`
                          : t("typeOptions.CASH")}
                    </p>
                  </div>
                </div>
                <Can I="finance.accounts">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button type="button" aria-label={t("rowActions")} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                        <MoreVertical className="size-4" aria-hidden />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onSelect={() => openEdit(account)}>
                        <Pencil className="mr-2 size-3.5" aria-hidden />
                        {t("edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setArchiving(account)}>
                        {t("archive")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </Can>
              </div>
            );
          })}
        </div>
      )}

      <AccountFormSheet open={formOpen} onOpenChange={setFormOpen} account={editing} />
      <ArchiveAccountDialog account={archiving} open={archiving != null} onOpenChange={(open) => !open && setArchiving(null)} />
    </Card>
  );
}
