"use client"; // filter reads (searchParams), paged query

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Pagination } from "@/components/shared/pagination";
import { useLedgerPagedList } from "../hooks/use-finance";
import { LedgerFilters } from "./ledger-filters";
import { LedgerPerformanceChart } from "./ledger-performance-chart";
import { LedgerTable } from "./ledger-table";
import type { FinanceCategory, FinanceTxnStatus } from "../types";

/** "Master Ledger" tab body — Figma node `1039:24848`: performance chart + margin stats, then a
 * "Transaction Ledger" card (search/category filter + table + pagination). The "Record"/"Wallet"
 * header buttons and the row-level Void action are deferred to the wizard/modals follow-up pass. */
export function LedgerView() {
  const t = useTranslations("finance.ledger");
  const searchParams = useSearchParams();

  const filters = {
    search: searchParams.get("search") ?? undefined,
    category: (searchParams.get("category") as FinanceCategory | null) ?? undefined,
    status: (searchParams.get("status") as FinanceTxnStatus | null) ?? undefined,
  };

  const query = useLedgerPagedList(filters);

  return (
    <div className="flex flex-col gap-4">
      <LedgerPerformanceChart chart={query.chart} />

      <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <p className="text-xl font-medium text-foreground">{t("tableTitle")}</p>
        <LedgerFilters />
        <LedgerTable items={query.items} isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()} />
        <Pagination page={query.page} totalPages={query.totalPages} onPageChange={query.goToPage} disabled={query.isFetching} />
      </div>
    </div>
  );
}
