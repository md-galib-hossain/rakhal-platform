"use client"; // client-side search filter (no server-side search param on GET /finance/liabilities)

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search } from "lucide-react";
import { CardSkeleton } from "@rakhal/ui/shared/card-skeleton";
import { DataTable } from "@/components/shared/data-table";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { MoneyText } from "@/components/shared/money-text";
import { Chip, type ChipProps } from "@rakhal/ui/ui/chip";
import { Input } from "@rakhal/ui/ui/input";
import { useLiabilities } from "../hooks/use-finance";
import type { Loan, LoanStatus } from "../types";
import type { ColumnDef } from "@tanstack/react-table";

const STATUS_VARIANT: Record<LoanStatus, ChipProps["variant"]> = {
  ACTIVE: "warning",
  CLOSED: "primary",
};

/**
 * "Liabilities" tab — Figma node `1039:33785`: Total Debt / Monthly EMI stat tiles + "Loan
 * Portfolio" table. Real gap vs the mock, flagged not fabricated: `finance.service.ts#liabilities`
 * maps each `FinanceLoan` to `{id, entityName, total, paid, outstanding, monthlyEmi, status}` only —
 * no date field survives that mapping (the model itself has `startDate`/`durationMonths`, not a
 * `dueDate`) — so the mock's "Due Date" column is dropped entirely rather than showing a fabricated
 * or misleading date. `GET /finance/liabilities` returns the
 * farm's full loan list directly (a farm keeps a handful of loans, never a paged list) with no
 * server-side search — search filters the already-loaded list client-side, same honest-frontier
 * approach as other small-list tabs in this app.
 */
export function LiabilitiesView() {
  const t = useTranslations("finance.liabilities");
  const query = useLiabilities();
  const [search, setSearch] = useState("");

  const loans = query.data?.loans;
  const filtered = useMemo(() => {
    const list = loans ?? [];
    if (!search.trim()) return list;
    const needle = search.trim().toLowerCase();
    return list.filter((l) => l.entityName.toLowerCase().includes(needle));
  }, [loans, search]);

  const columns = useMemo<ColumnDef<Loan, unknown>[]>(
    () => [
      {
        id: "lender",
        header: t("columns.lender"),
        cell: ({ row }) => <span className="text-sm font-medium text-foreground">{row.original.entityName}</span>,
      },
      { id: "total", header: t("columns.total"), cell: ({ row }) => <MoneyText amount={row.original.total} /> },
      { id: "paid", header: t("columns.paid"), cell: ({ row }) => <MoneyText amount={row.original.paid} /> },
      { id: "outstanding", header: t("columns.outstanding"), cell: ({ row }) => <MoneyText amount={row.original.outstanding} /> },
      { id: "monthlyEmi", header: t("columns.monthlyEmi"), cell: ({ row }) => <MoneyText amount={row.original.monthlyEmi} /> },
      {
        id: "status",
        header: t("columns.status"),
        cell: ({ row }) => <Chip variant={STATUS_VARIANT[row.original.status]}>{t(`statusOptions.${row.original.status}`)}</Chip>,
      },
    ],
    [t],
  );

  if (query.isLoading) return <CardSkeleton lines={6} className="rounded-2xl" />;
  if (query.isError) {
    return (
      <div className="rounded-2xl border border-border p-4">
        <ErrorState description={t("error")} onRetry={() => void query.refetch()} />
      </div>
    );
  }
  const stats = query.data?.stats;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="flex flex-1 flex-col gap-1 rounded-xl border border-border p-4">
          <p className="text-sm font-medium text-foreground">{t("stats.totalDebt")}</p>
          <p className="text-2xl font-bold text-foreground">
            <MoneyText amount={stats?.totalDebt ?? 0} />
          </p>
        </div>
        <div className="flex flex-1 flex-col gap-1 rounded-xl border border-border p-4">
          <p className="text-sm font-medium text-foreground">{t("stats.monthlyEmi")}</p>
          <p className="text-2xl font-bold text-foreground">
            <MoneyText amount={stats?.monthlyEmi ?? 0} />
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xl font-medium text-foreground">{t("title")}</p>
          <div className="relative w-[260px] shrink-0">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="pl-9"
              aria-label={t("searchPlaceholder")}
            />
          </div>
        </div>

        <div
          className={[
            "overflow-hidden rounded-2xl border border-border",
            "[&_thead_tr]:border-b-0 [&_thead_tr]:bg-muted",
            "[&_thead_th]:h-[54px] [&_thead_th]:text-sm [&_thead_th]:font-medium [&_thead_th]:normal-case [&_thead_th]:tracking-normal [&_thead_th]:text-muted-foreground",
            "[&_tbody_td]:py-2",
          ].join(" ")}
        >
          <DataTable
            columns={columns}
            data={filtered}
            getRowId={(row) => row.id}
            emptyState={{ title: t("empty.title"), description: t("empty.description") }}
          />
        </div>
      </div>
    </div>
  );
}
