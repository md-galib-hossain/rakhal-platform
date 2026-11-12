"use client"; // reads the account list

import { RakhalBalanceCard } from "./rakhal-balance-card";
import { AccountList } from "./account-list";
import { AccountCard } from "./account-card";
import { useFinancialAccounts } from "../../hooks/use-finance-v2";

/**
 * RAKHAL-356 — Finance V2 Accounts + Rakhal Balance screen. A farm has a single financial account, so
 * the page is the balance headline plus that account (rename / opening balance). Farms that predate
 * the one-account rule and still hold several accounts keep the full list so nothing is hidden.
 */
export function AccountsView() {
  const accounts = useFinancialAccounts();
  const isLegacyMulti = (accounts.data?.length ?? 0) > 1;
  return (
    <div className="flex flex-col gap-4">
      <RakhalBalanceCard />
      {isLegacyMulti ? <AccountList /> : <AccountCard />}
    </div>
  );
}
