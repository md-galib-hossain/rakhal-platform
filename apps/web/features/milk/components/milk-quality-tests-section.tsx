"use client"; // live query + dialog state

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import type { ColumnDef } from "@tanstack/react-table";
import { FlaskConical } from "lucide-react";
import { Button } from "@rakhal/ui/ui/button";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { DataTable } from "@/components/shared/data-table";
import { DateText } from "@/components/shared/date-text";
import { Can } from "@/lib/auth/permissions";
import { useMilkQualityTests } from "../hooks/use-milk-quality-tests";
import { MilkQualityTestDialog } from "./milk-quality-test-dialog";
import type { MilkQualityTest, MilkQualityTestSource } from "../types";

const SOURCE_VARIANT: Record<MilkQualityTestSource, ChipProps["variant"]> = {
  LAB: "primary",
  DEVICE: "info",
  MANUAL: "muted",
};

/** Quality-test history table (RAKHAL-282/293-F) — `GET /milk/quality-tests?cattleId=`, cursor "load
 * more" via `DataTable`. Slotted into the cattle detail Overview tab, right after "Recent Daily
 * Records": both are milk-production data for this cow, quality tests are the lab/device composition
 * counterpart to the daily-yield table above it. */
export function MilkQualityTestsSection({ cattleId }: { cattleId: string }) {
  const t = useTranslations("cattle.detail.performance.qualityTests");
  const [dialogOpen, setDialogOpen] = useState(false);
  const query = useMilkQualityTests(cattleId);

  const rows = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);

  const columns = useMemo<ColumnDef<MilkQualityTest, unknown>[]>(
    () => [
      {
        id: "sampleDate",
        header: t("columns.sampleDate"),
        cell: ({ row }) => <DateText date={row.original.sampleDate} />,
      },
      {
        id: "fatPct",
        header: t("columns.fatPct"),
        cell: ({ row }) => t("pctValue", { value: row.original.fatPct }),
      },
      {
        id: "proteinPct",
        header: t("columns.proteinPct"),
        cell: ({ row }) => t("pctValue", { value: row.original.proteinPct }),
      },
      {
        id: "lactosePct",
        header: t("columns.lactosePct"),
        cell: ({ row }) => (row.original.lactosePct != null ? t("pctValue", { value: row.original.lactosePct }) : "—"),
      },
      {
        id: "somaticCellCount",
        header: t("columns.somaticCellCount"),
        cell: ({ row }) => row.original.somaticCellCount ?? "—",
      },
      {
        id: "milkUreaNitrogen",
        header: t("columns.milkUreaNitrogen"),
        cell: ({ row }) => row.original.milkUreaNitrogen ?? "—",
      },
      {
        id: "source",
        header: t("columns.source"),
        cell: ({ row }) => <Chip variant={SOURCE_VARIANT[row.original.source]}>{t(`sourceOptions.${row.original.source}`)}</Chip>,
      },
    ],
    [t],
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
        <Can I="milk.quality.create">
          <Button variant="outline" size="sm" className="gap-2" onClick={() => setDialogOpen(true)}>
            <FlaskConical className="size-4" aria-hidden />
            {t("recordTest")}
          </Button>
        </Can>
      </div>

      <DataTable
        columns={columns}
        data={rows}
        getRowId={(row) => row.id}
        isLoading={query.isLoading}
        isError={query.isError}
        onRetry={() => query.refetch()}
        emptyState={{ title: t("empty.title"), description: t("empty.description") }}
        hasNextPage={query.hasNextPage}
        isFetchingNextPage={query.isFetchingNextPage}
        onLoadMore={() => void query.fetchNextPage()}
      />

      <MilkQualityTestDialog cattleId={cattleId} open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
