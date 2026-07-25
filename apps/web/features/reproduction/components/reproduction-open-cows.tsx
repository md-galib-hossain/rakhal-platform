"use client"; // live query + DataTable

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { useReproductionDashboard } from "../hooks/use-reproduction";
import type { OpenCowRow } from "../types";
import { ReproductionCard } from "./reproduction-card";

/** "Open Cow List" (PRD §9.2) — every OPEN cow past VWP, most urgent (highest Days Open) first, as
 * the backend already returns them (`reproduction.service.ts`'s `open_cows`, ordered by createdAt —
 * shown as-is since re-sorting client-side would fight the server's own ordering). Reuses the shared
 * `DataTable` (Cattle/Inventory's own list pattern) even though this list has no pagination controls
 * of its own — the backend caps it at 50 rows server-side, no "Load more" needed. */
export function ReproductionOpenCows() {
  const t = useTranslations("reproduction.openCows");
  const dashboard = useReproductionDashboard();

  const columns = useMemo<ColumnDef<OpenCowRow, unknown>[]>(
    () => [
      {
        id: "name",
        header: t("columns.cow"),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium text-foreground">{row.original.name ?? row.original.tag}</span>
            {row.original.name ? <span className="text-xs text-muted-foreground">{row.original.tag}</span> : null}
          </div>
        ),
      },
      {
        id: "dim",
        header: t("columns.dim"),
        cell: ({ row }) => row.original.dim ?? "—",
      },
      {
        id: "daysOpen",
        header: t("columns.daysOpen"),
        cell: ({ row }) => row.original.days_open ?? "—",
      },
      {
        id: "lastAiDate",
        header: t("columns.lastAiDate"),
        cell: ({ row }) => (row.original.last_ai_date ? <DateText date={row.original.last_ai_date} /> : "—"),
      },
      {
        id: "conceptionRate",
        header: t("columns.conceptionRate"),
        cell: ({ row }) => (row.original.conception_rate_pct != null ? `${row.original.conception_rate_pct}%` : "—"),
      },
    ],
    [t],
  );

  return (
    <ReproductionCard title={t("title")}>
      <DataTable
        columns={columns}
        data={dashboard.data?.open_cows ?? []}
        getRowId={(row) => row.cattle_id}
        isLoading={dashboard.isLoading}
        isError={dashboard.isError}
        onRetry={() => dashboard.refetch()}
        emptyState={{ title: t("empty") }}
      />
    </ReproductionCard>
  );
}
