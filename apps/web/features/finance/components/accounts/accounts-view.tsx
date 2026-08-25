"use client"; // dialog-open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/lib/auth/permissions";
import { RakhalBalanceCard } from "./rakhal-balance-card";
import { AccountList } from "./account-list";
import { TransferFormSheet } from "./transfer-form-sheet";

/**
 * RAKHAL-356 — Finance V2 Accounts + Rakhal Balance screen. Top-level composition: balance headline
 * + position block, a "Transfer" action, and the account list. See `app/(app)/finance/accounts/
 * page.tsx`'s doc comment for why this lives at its own route rather than as a 6th V1 tab.
 */
export function AccountsView() {
  const t = useTranslations("finance.accountsPage");
  const [transferOpen, setTransferOpen] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-end">
        <Can
          I="finance.transfer"
          fallback={
            <Button variant="secondary" className="gap-1.5" disabled title={t("transferOwnerOnlyTooltip")}>
              <ArrowLeftRight className="size-4" aria-hidden />
              {t("transferAction")}
            </Button>
          }
        >
          <Button variant="secondary" className="gap-1.5" onClick={() => setTransferOpen(true)}>
            <ArrowLeftRight className="size-4" aria-hidden />
            {t("transferAction")}
          </Button>
        </Can>
      </div>

      <RakhalBalanceCard />
      <AccountList />

      <TransferFormSheet open={transferOpen} onOpenChange={setTransferOpen} />
    </div>
  );
}
