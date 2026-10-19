"use client"; // keeps a bound form value in sync with the farm account

import { useEffect } from "react";
import { useFarmAccount } from "../hooks/use-finance-v2";

/**
 * One finance account per farm: no money form asks the farmer which wallet. This renders nothing and
 * just keeps the bound form value set to the farm's single account (`GET /finance/accounts/farm-account`,
 * created as "Main Wallet" on first use), so every existing `Controller` / schema / payload that carries
 * `financialAccountId` keeps working unchanged.
 */
export function AccountPicker({ value, onChange }: { value: string | undefined; onChange: (accountId: string) => void; placeholder?: string; className?: string; error?: string }) {
  const { data } = useFarmAccount();
  useEffect(() => {
    if (data?.id && value !== data.id) onChange(data.id);
  }, [data?.id, value, onChange]);
  return null;
}
