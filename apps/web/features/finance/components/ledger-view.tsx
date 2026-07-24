"use client"; // filter reads (searchParams), paged query

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Pagination } from "@/components/shared/pagination";
import { useLedgerPagedList } from "../hooks/use-finance";
import { LedgerFilters } from "./ledger-filters";
import { LedgerPerformanceChart } from "./ledger-performance-chart";
import { LedgerTable } from "./ledger-table";
import { VoidTransactionDialog } from "./void-transaction-dialog";
import type { FinanceCategory, FinanceTxnStatus, LedgerTransaction } from "../types";

/** "Master Ledger" tab body — Figma node `1039:24848`: performance chart + margin stats, then a
 * "Transaction Ledger" card (search/category filter + table + pagination). The row-level Void
 * action (previously deferred) now opens `VoidTransactionDialog`. */
export function LedgerView() {
  const t = useTranslations("finance.ledger");
  const searchParams = useSearchParams();
  const [voidTarget, setVoidTarget] = useState<LedgerTransaction | null>(null);

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
        <LedgerTable
          items={query.items}
          isLoading={query.isLoading}
          isError={query.isError}
          onRetry={() => void query.refetch()}
          onVoid={setVoidTarget}
        />
        <Pagination
          page={query.page}
          totalPages={query.totalPages}
          onPageChange={query.goToPage}
          isFetching={query.isFetching}
          pageSize={query.pageSize}
          onPageSizeChange={query.setPageSize}
        />
      </div>

      <VoidTransactionDialog
        transaction={voidTarget}
        open={voidTarget != null}
        onOpenChange={(open) => !open && setVoidTarget(null)}
      />
    </div>
  );
}
