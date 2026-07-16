"use client"; // filter reads (searchParams), paged query

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { FilterBar } from "@/components/shared/filter-bar";
import { MoneyText } from "@/components/shared/money-text";
import { Pagination } from "@/components/shared/pagination";
import { usePayablesPagedList, useReceivablesPagedList } from "../hooks/use-finance";
import { SettlementsTable } from "./settlements-table";
import type { ReceivableKind, ReceivableStatus } from "../types";

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-1 flex-col gap-1 rounded-xl border border-border p-4">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground">
        <MoneyText amount={value} />
      </p>
    </div>
  );
}

const STATUSES: ReceivableStatus[] = ["PENDING", "PARTIAL", "COMPLETED", "OVERDUE"];

/**
 * Shared Receivables/Payables tab body — Figma nodes `1039:33347`/`1039:33566`: 3 stat tiles
 * (Total.../Pending.../Overdue), search+status filter, "Accounts Receivable"/"Accounts Payable"
 * table, pagination. `kind` picks the right paged-list hook (each is its own `GET
 * /finance/{receivables,payables}` call) — a thin `ReceivablesView`/`PayablesView` wrapper below
 * each call their own hook (hooks can't be picked dynamically) and hand the result to this shared
 * presentational body.
 */
function SettlementsViewBody({
  kind,
  query,
}: {
  kind: ReceivableKind;
  query: ReturnType<typeof useReceivablesPagedList>;
}) {
  const namespace = kind === "RECEIVABLE" ? "finance.receivables" : "finance.payables";
  const t = useTranslations(namespace);
  const stats = query.stats;

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
      <p className="text-xl font-medium text-foreground">{t("title")}</p>

      <div className="flex flex-col gap-3 sm:flex-row">
        <StatTile label={t("stats.total")} value={stats?.totalOutstanding ?? 0} />
        <StatTile label={t("stats.pending")} value={stats?.pendingToday ?? 0} />
        <StatTile label={t("stats.overdue")} value={stats?.overdue ?? 0} />
      </div>

      <FilterBar
        layout="split"
        searchKey="search"
        searchPlaceholder={t("searchPlaceholder")}
        selects={[
          {
            key: "status",
            label: t("statusFilter"),
            options: STATUSES.map((s) => ({ value: s, label: t(`statusOptions.${s}`) })),
          },
        ]}
      />

      <SettlementsTable kind={kind} items={query.items} isLoading={query.isLoading} isError={query.isError} onRetry={() => void query.refetch()} />

      <Pagination page={query.page} totalPages={query.totalPages} onPageChange={query.goToPage} disabled={query.isFetching} />
    </div>
  );
}

export function ReceivablesView() {
  const searchParams = useSearchParams();
  const filters = {
    search: searchParams.get("search") ?? undefined,
    status: (searchParams.get("status") as ReceivableStatus | null) ?? undefined,
  };
  const query = useReceivablesPagedList(filters);
  return <SettlementsViewBody kind="RECEIVABLE" query={query} />;
}

export function PayablesView() {
  const searchParams = useSearchParams();
  const filters = {
    search: searchParams.get("search") ?? undefined,
    status: (searchParams.get("status") as ReceivableStatus | null) ?? undefined,
  };
  const query = usePayablesPagedList(filters);
  return <SettlementsViewBody kind="PAYABLE" query={query} />;
}
