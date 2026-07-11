"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { CattleListItem, HealthStatusFilter, ProductionStatus } from "../types";

/** Radix `Avatar` (plain `<img>` under the hood) rather than `next/image` for the 40px list
 * thumbnail — the signed R2 URL's host isn't a fixed, config-time-known hostname (varies by
 * `R2_ACCOUNT_ID`/optional public CDN override), and `Avatar` already gives the loading/error
 * fallback this cheap thumbnail needs for free. */
function CattleThumbnail({ cattle }: { cattle: CattleListItem }) {
  const initial = (cattle.name ?? cattle.tagNumber).charAt(0).toUpperCase();
  return (
    <Avatar className="size-9">
      {cattle.profile_photo ? <AvatarImage src={cattle.profile_photo.thumb_url} alt="" /> : null}
      <AvatarFallback>{initial}</AvatarFallback>
    </Avatar>
  );
}

const PRODUCTION_STATUS_VARIANT: Record<ProductionStatus, "success" | "info" | "warning" | "secondary" | "destructive"> = {
  MILKING: "success",
  FRESH: "info",
  DRY: "warning",
  GROWING: "secondary",
  SOLD: "secondary",
  DECEASED: "destructive",
};

const HEALTH_STATUS_VARIANT: Record<HealthStatusFilter, "success" | "warning" | "destructive"> = {
  HEALTHY: "success",
  SICK: "destructive",
  IN_TREATMENT: "warning",
  WITHHOLDING: "warning",
  QUARANTINE: "warning",
};

export function buildCattleColumns(t: (key: string) => string): ColumnDef<CattleListItem, unknown>[] {
  return [
    {
      id: "cattle",
      header: t("columns.cattle"),
      cell: ({ row }) => {
        const cattle = row.original;
        // No detail route yet (RFE-023, separate ticket) — plain row, not a dead link.
        return (
          <div className="flex items-center gap-3">
            <CattleThumbnail cattle={cattle} />
            <span className="flex flex-col">
              <span className="font-medium text-foreground">{cattle.name ?? cattle.tagNumber}</span>
              <span className="text-xs text-muted-foreground">{cattle.tagNumber}</span>
            </span>
          </div>
        );
      },
    },
    {
      id: "breed",
      header: t("columns.breed"),
      cell: ({ row }) => row.original.breed?.name ?? "—",
    },
    {
      id: "shed",
      header: t("columns.shed"),
      cell: ({ row }) => row.original.shed?.name ?? "—",
    },
    {
      id: "productionStatus",
      header: t("columns.status"),
      cell: ({ row }) => (
        <Badge variant={PRODUCTION_STATUS_VARIANT[row.original.productionStatus]}>
          {t(`statusOptions.${row.original.productionStatus.toLowerCase()}`)}
        </Badge>
      ),
    },
    {
      id: "healthStatus",
      header: t("columns.health"),
      cell: ({ row }) => (
        <Badge variant={HEALTH_STATUS_VARIANT[row.original.healthStatus]}>
          {t(`healthOptions.${toHealthKey(row.original.healthStatus)}`)}
        </Badge>
      ),
    },
    {
      id: "aqrScore",
      header: t("columns.aqr"),
      cell: ({ row }) => row.original.aqrScore ?? "—",
      meta: { sortField: "aqrScore" },
    },
    {
      id: "dim",
      header: t("columns.dim"),
      cell: ({ row }) => row.original.dim ?? "—",
    },
    {
      id: "lastWeightKg",
      header: t("columns.weight"),
      cell: ({ row }) => (row.original.lastWeightKg != null ? `${row.original.lastWeightKg} kg` : "—"),
    },
    {
      id: "lastBcs",
      header: t("columns.bcs"),
      cell: ({ row }) => row.original.lastBcs ?? "—",
    },
  ];
}

function toHealthKey(status: HealthStatusFilter): string {
  return status === "IN_TREATMENT" ? "inTreatment" : status.toLowerCase();
}
