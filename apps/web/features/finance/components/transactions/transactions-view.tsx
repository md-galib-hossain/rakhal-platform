"use client"; // filter state (type/status/period)

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePeriod } from "@/lib/hooks/use-period";
import { TransactionsFiltersBar } from "./transactions-filters";
import { TransactionsTable } from "./transactions-table";
import type { TransactionsFilters } from "./types";

/** RAKHAL-385 (MILESTONE 22) — Finance → Transactions screen (`BUSINESS_IA_PRD.md` §5.3). Composes
 * the filter bar + table; owns `type`/`status` local state and `usePeriod()` (RAKHAL-380) for the
 * date range, passed down as one `TransactionsFilters` object so the table's query key stays a
 * single source of truth. Mounted both as the `transactions` tab inside `FinanceView` (`?tab=`) and
 * standalone at `/finance/transactions` — same "one component, two entry points" pattern
 * `AccountsView` already established. */
export function TransactionsView() {
  const t = useTranslations("finance.transactionsV2");
  const [type, setType] = useState<string | undefined>(undefined);
  const [status, setStatus] = useState<"POSTED" | "REVERSED" | undefined>(undefined);
  const period = usePeriod("this_month");

  const filters: TransactionsFilters = {
    type,
    status,
    from: period.from.toISOString(),
    to: period.to.toISOString(),
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-lg font-medium text-foreground">{t("title")}</p>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </div>
      <TransactionsFiltersBar type={type} onTypeChange={setType} status={status} onStatusChange={setStatus} period={period} />
      <TransactionsTable filters={filters} />
    </div>
  );
}
