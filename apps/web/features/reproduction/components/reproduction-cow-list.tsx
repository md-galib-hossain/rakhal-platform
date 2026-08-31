"use client"; // live query + DataTable

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { AnimalLink } from "@/components/shared/animal-link";
import { useReproductionCows } from "../hooks/use-reproduction";
import type { ReproductionCowRow, ReproductiveStatus } from "../types";
import { ReproductionCard } from "./reproduction-card";

const STATUS_VARIANT: Record<ReproductiveStatus, ChipProps["variant"]> = {
  NOT_ELIGIBLE: "muted",
  POSTPARTUM_WAITING: "muted",
  OPEN: "warning",
  BRED_AWAITING_CONFIRMATION: "info",
  PREGNANT: "teal",
};

/** RAKHAL-363 — replaces the old OPEN-only "Open Cow List" (`reproduction-open-cows.tsx`, now unused)
 * with every cow currently in an active reproductive cycle (Open/Inseminated/Pregnant), real cursor
 * "load more" via `DataTable` (`GET /reproduction/cows`, `reproduction.service.ts`'s
 * `listReproductionCows`) instead of the dashboard's capped, uncapped-pagination `open_cows[]`. */
export function ReproductionCowList() {
  const t = useTranslations("reproduction.cowList");
  const query = useReproductionCows();

  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const columns = useMemo<ColumnDef<ReproductionCowRow, unknown>[]>(
    () => [
      {
        id: "cow",
        header: t("columns.cow"),
        cell: ({ row }) => (
          <AnimalLink
            id={row.original.cattle_id}
            animalName={row.original.name}
            tagNumber={row.original.tag}
            className="flex flex-col text-left group font-normal"
          >
            <span className="font-medium text-foreground group-hover:underline">{row.original.name ?? row.original.tag}</span>
            {row.original.name ? <span className="text-xs text-muted-foreground">{row.original.tag}</span> : null}
          </AnimalLink>
        ),
      },
      {
        id: "status",
        header: t("columns.status"),
        cell: ({ row }) =>
          row.original.status ? (
            <Chip variant={STATUS_VARIANT[row.original.status]}>{t(`statusValues.${row.original.status}`)}</Chip>
          ) : (
            "—"
          ),
      },
      {
        id: "lastAiDate",
        header: t("columns.lastAiDate"),
        cell: ({ row }) => (row.original.last_ai_date ? <DateText date={row.original.last_ai_date} /> : "—"),
      },
      {
        id: "pregnancyChecked",
        header: t("columns.pregnancyChecked"),
        cell: ({ row }) => (row.original.pregnancy_checked ? t("checkedYes") : t("checkedNo")),
      },
      {
        id: "daysOpen",
        header: t("columns.daysOpen"),
        cell: ({ row }) => row.original.days_open ?? "—",
      },
      {
        id: "daysPregnant",
        header: t("columns.daysPregnant"),
        cell: ({ row }) => row.original.days_pregnant ?? "—",
      },
      {
        id: "expectedCalvingDate",
        header: t("columns.expectedCalvingDate"),
        cell: ({ row }) =>
          row.original.expected_calving_date ? <DateText date={row.original.expected_calving_date} /> : "—",
      },
    ],
    [t],
  );

  return (
    <ReproductionCard title={t("title")}>
      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.cattle_id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        emptyState={{ title: t("empty") }}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />
    </ReproductionCard>
  );
}
