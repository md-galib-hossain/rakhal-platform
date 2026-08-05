"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Mars, TriangleAlert, Venus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { avatarTint } from "../avatar-tint";
import { formatCattleAge } from "../format";
import { CattleRowActions } from "./cattle-row-actions";
import type { AnimalCategory, CattleListItem, ProductionStatus } from "../types";

/** Radix `Avatar` (plain `<img>` under the hood) rather than `next/image` for the 32px list
 * thumbnail — the signed R2 URL's host isn't a fixed, config-time-known hostname (varies by
 * `R2_ACCOUNT_ID`/optional public CDN override), and `Avatar` already gives the loading/error
 * fallback this cheap thumbnail needs for free. */
function CattleThumbnail({ cattle }: { cattle: CattleListItem }) {
  const initial = (cattle.name ?? cattle.tagNumber).charAt(0).toUpperCase();
  return (
    <Avatar className="size-8">
      {cattle.profile_photo ? <AvatarImage src={cattle.profile_photo.thumb_url} alt="" /> : null}
      <AvatarFallback className={avatarTint(cattle.id)}>{initial}</AvatarFallback>
    </Avatar>
  );
}

/** Figma's "male-symbol"/"female-symbol" glyph next to the tag number — `CASTRATED_MALE` still
 * reads as male (no third glyph in the design). */
function GenderGlyph({ gender }: { gender: CattleListItem["gender"] }) {
  if (gender === "FEMALE") return <Venus className="size-3.5 text-accent-pink" aria-hidden />;
  return <Mars className="size-3.5 text-info" aria-hidden />;
}

const PRODUCTION_STATUS_VARIANT: Record<ProductionStatus, ChipProps["variant"]> = {
  MILKING: "primary",
  DRY: "warning",
};

/** RAKHAL-270 — `animalCategory` chip colors, distinct from the production-status chip above. */
const ANIMAL_CATEGORY_VARIANT: Record<AnimalCategory, ChipProps["variant"]> = {
  CALF: "info",
  HEIFER: "purple",
  COW: "primary",
  BULL: "indigo",
  STEER: "teal",
};

/** RAKHAL-272 — compact table indicator for `reproductionAlerts`: a small warning dot + count, full
 * label list on hover. A full badge row (like the detail view gets) doesn't fit an 8-column table;
 * this is deliberately the cheaper of the two per the ticket's own guidance. */
function ReproductionAlertsIndicator({
  alerts,
  t,
}: {
  alerts: CattleListItem["reproductionAlerts"];
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  if (alerts.length === 0) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex items-center gap-0.5 text-warning" aria-label={t("reproductionAlerts.count", { count: alerts.length })}>
          <TriangleAlert className="size-3.5" aria-hidden />
          <span className="text-xs font-semibold">{alerts.length}</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <ul className="flex flex-col gap-0.5">
          {alerts.map((alert) => (
            <li key={alert}>{t(`reproductionAlerts.${alert}`)}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Column set pixel-matched to the Figma "Cattle" table: Name/Breed/Age/Weight/Shed/AQR Score/
 * Status/Action, 8 columns — dropped the previous (real, but Figma-divergent) Health/DIM/BCS
 * columns to match. **Real information trade-off, not silently dropped**: Health status is still
 * fully real data — filterable via the existing Health select in `CattleFilters` and shown in the
 * "View Details" drawer's Health tab — just no longer a list column. Figma's own mock "Status"
 * values (e.g. "Active Breeder") don't map to any real field this backend has (not
 * `productionStatus`, not `reproductiveStatus`); `productionStatus` (RAKHAL-269 v2: trimmed to
 * Milking/Dry, nullable) is the real closest match and is used here rather than fabricating a
 * field.
 */
export function buildCattleColumns(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  rowActions: {
    onView: (cattle: CattleListItem) => void;
    onEdit: (cattle: CattleListItem) => void;
    onChangeStatus: (cattle: CattleListItem) => void;
    onArchive: (cattle: CattleListItem) => void;
  },
): ColumnDef<CattleListItem, unknown>[] {
  return [
    {
      id: "cattle",
      header: t("columns.cattle"),
      cell: ({ row }) => {
        const cattle = row.original;
        return (
          <button
            type="button"
            onClick={() => rowActions.onView(cattle)}
            className="flex items-center gap-2 text-left hover:underline"
          >
            <CattleThumbnail cattle={cattle} />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-foreground">{cattle.name ?? cattle.tagNumber}</span>
              <span className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">{cattle.tagNumber}</span>
                <GenderGlyph gender={cattle.gender} />
              </span>
            </span>
          </button>
        );
      },
    },
    {
      id: "animalCategory",
      header: t("columns.category"),
      cell: ({ row }) => {
        const category = row.original.animalCategory;
        return <Chip variant={ANIMAL_CATEGORY_VARIANT[category]}>{t(`animalCategory.${category}`)}</Chip>;
      },
    },
    {
      id: "breed",
      header: t("columns.breed"),
      cell: ({ row }) => row.original.breed?.name ?? "—",
    },
    {
      id: "age",
      header: t("columns.age"),
      cell: ({ row }) => formatCattleAge(row.original.dateOfBirth, t),
    },
    {
      id: "lastWeightKg",
      header: t("columns.weight"),
      cell: ({ row }) => (row.original.lastWeightKg != null ? `${row.original.lastWeightKg} kg` : "—"),
    },
    {
      id: "shed",
      header: t("columns.shed"),
      cell: ({ row }) => row.original.shed?.name ?? "—",
    },
    {
      id: "aqrScore",
      header: t("columns.aqr"),
      cell: ({ row }) =>
        row.original.aqrScore != null ? (
          <span>
            <span className="font-medium text-primary">{row.original.aqrScore}</span>
            <span className="text-muted-foreground">/100</span>
          </span>
        ) : (
          "—"
        ),
      meta: { sortField: "aqrScore" },
    },
    {
      id: "productionStatus",
      header: t("columns.status"),
      cell: ({ row }) => {
        const status = row.original.productionStatus;
        return (
          <span className="flex items-center gap-1.5">
            {status ? (
              <Chip variant={PRODUCTION_STATUS_VARIANT[status]}>{t(`statusOptions.${status.toLowerCase()}`)}</Chip>
            ) : (
              "—"
            )}
            <ReproductionAlertsIndicator alerts={row.original.reproductionAlerts} t={t} />
          </span>
        );
      },
    },
    {
      id: "__actions__",
      header: t("columns.action"),
      size: 72,
      cell: ({ row }) => (
        <div className="flex justify-center">
          <CattleRowActions
            cattle={row.original}
            onView={rowActions.onView}
            onEdit={rowActions.onEdit}
            onChangeStatus={rowActions.onChangeStatus}
            onArchive={rowActions.onArchive}
          />
        </div>
      ),
    },
  ];
}
