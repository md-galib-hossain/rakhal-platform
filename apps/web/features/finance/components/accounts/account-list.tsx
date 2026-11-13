"use client"; // list query + row action state

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Landmark, MoreVertical, Pencil, Smartphone, Star, Wallet } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/errors";
import { Badge } from "@rakhal/ui/ui/badge";
import { Card } from "@rakhal/ui/ui/card";
import { Button } from "@rakhal/ui/ui/button";
import { DataTable } from "@/components/shared/data-table";
import { MoneyText } from "@/components/shared/money-text";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Can } from "@/lib/auth/permissions";
import { useFinancialAccounts, useRakhalBalance, useSetPrimaryFinancialAccount } from "../../hooks/use-finance-v2";
import { AccountFormSheet } from "./account-form-sheet";
import { ArchiveAccountDialog } from "./archive-account-dialog";
import type { FinancialAccount, FinancialAccountType } from "../../types-v2";

const TYPE_ICON: Record<FinancialAccountType, typeof Wallet> = {
  CASH: Wallet,
  BANK: Landmark,
  MFS: Smartphone,
};

/**
 * RAKHAL-384 — Accounts screen: `Account Name | Type | Account No / Info | Current Balance | Status |
 * Actions`, one row per `FinancialAccount` (a farm with 3 banks + 2 MFS wallets shows 5 rows — never
 * one aggregate "MFS" row; `GET /finance/accounts` already returns per-account rows, this table just
 * stopped rendering a card grid without a balance column). `Current Balance` is joined client-side
 * from `useRakhalBalance()`'s own `accounts[]` (same `GET /finance/balance` call `RakhalBalanceCard`
 * above this table already makes — cached, no extra request) by `id`; both endpoints default to
 * active-only so every row here has a match. `Status` is always "Active" today since neither endpoint
 * has an `includeArchived` param wired on the frontend (an archived account simply drops off both
 * lists) — the column is still real per the AC, not a placeholder, and is where a future archived-
 * account toggle would render "Archived" instead.
 */
export function AccountList() {
  const t = useTranslations("finance.accountsPage.list");
  const query = useFinancialAccounts();
  const balanceQuery = useRakhalBalance();
  const { mutateAsync: setPrimaryAsync } = useSetPrimaryFinancialAccount();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinancialAccount | undefined>(undefined);
  const [archiving, setArchiving] = useState<FinancialAccount | null>(null);
  const accountCount = query.data?.length ?? 0;

  const balanceById = useMemo(
    () => new Map((balanceQuery.data?.accounts ?? []).map((a) => [a.id, a.balance])),
    [balanceQuery.data],
  );

  const handleMakePrimary = useCallback(
    async (account: FinancialAccount) => {
      try {
        await setPrimaryAsync(account.id);
        toast.success(t("primarySetToast", { name: account.name }));
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : t("primarySetError"));
      }
    },
    [setPrimaryAsync, t],
  );

  function openEdit(account: FinancialAccount) {
    setEditing(account);
    setFormOpen(true);
  }

  const columns = useMemo<ColumnDef<FinancialAccount, unknown>[]>(
    () => [
      {
        id: "name",
        header: t("columns.name"),
        cell: ({ row }) => {
          const account = row.original;
          const Icon = TYPE_ICON[account.type];
          return (
            <div className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-info-tint text-info shadow-xs">
                <Icon className="size-4" aria-hidden />
              </span>
              <span className="text-sm font-medium text-foreground">{account.name}</span>
              {account.isPrimary ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-xs font-semibold text-success">
                  <Star className="size-3 shrink-0 fill-current" aria-hidden />
                  {t("primaryBadge")}
                </span>
              ) : null}
            </div>
          );
        },
      },
      {
        id: "type",
        header: t("columns.type"),
        cell: ({ row }) => (
          <span className="text-sm text-foreground">
            {t(`typeOptions.${row.original.type === "MFS" && row.original.mfsDetail ? row.original.mfsDetail.provider : row.original.type}`)}
          </span>
        ),
      },
      {
        id: "info",
        header: t("columns.info"),
        cell: ({ row }) => {
          const account = row.original;
          const info =
            account.type === "BANK" && account.bankDetail
              ? `${account.bankDetail.bankName} · ${account.bankDetail.accountNumber}`
              : account.type === "MFS" && account.mfsDetail
                ? account.mfsDetail.phoneNumber
                : null;
          return <span className="text-sm text-muted-foreground">{info ?? t("infoNone")}</span>;
        },
      },
      {
        id: "balance",
        header: t("columns.balance"),
        cell: ({ row }) => {
          const balance = balanceById.get(row.original.id);
          return balance != null ? <MoneyText amount={Number(balance)} /> : <span className="text-sm text-muted-foreground">—</span>;
        },
      },
      {
        id: "status",
        header: t("columns.status"),
        cell: ({ row }) => (
          <Badge variant={row.original.deletedAt == null ? "success" : "outline"}>
            {row.original.deletedAt == null ? t("status.active") : t("status.archived")}
          </Badge>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Can I="finance.accounts">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label={t("rowActions")} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground">
                  <MoreVertical className="size-4" aria-hidden />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => openEdit(row.original)}>
                  <Pencil className="mr-2 size-3.5" aria-hidden />
                  {t("edit")}
                </DropdownMenuItem>
                {row.original.isPrimary || accountCount <= 1 ? null : (
                  <DropdownMenuItem onSelect={() => void handleMakePrimary(row.original)}>
                    <Star className="mr-2 size-3.5" aria-hidden />
                    {t("makePrimary")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setArchiving(row.original)}>
                  {t("archive")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </Can>
        ),
      },
    ],
    [t, balanceById, handleMakePrimary, accountCount],
  );

  return (
    <Card className="flex flex-col gap-4 rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-lg font-medium text-foreground">{t("title")}</p>
      </div>

      <div className="overflow-hidden rounded-xl border border-border [&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted [&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground [&_tbody_td]:py-2">
        <DataTable
          columns={columns}
          data={query.data ?? []}
          getRowId={(row) => row.id}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          emptyState={{
            title: t("empty.title"),
            description: t("empty.description"),
          }}
        />
      </div>

      {editing ? <AccountFormSheet open={formOpen} onOpenChange={setFormOpen} account={editing} /> : null}
      <ArchiveAccountDialog account={archiving} open={archiving != null} onOpenChange={(open) => !open && setArchiving(null)} />
    </Card>
  );
}
