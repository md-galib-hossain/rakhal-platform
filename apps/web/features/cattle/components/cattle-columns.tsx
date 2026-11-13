"use client"; // column defs consumed by the client-only DataTable

import type { ColumnDef } from "@tanstack/react-table";
import { Mars, TriangleAlert, Venus } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@rakhal/ui/ui/avatar";
import { Chip, type ChipProps } from "@rakhal/ui/ui/chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@rakhal/ui/ui/tooltip";
import { TruncatedText } from "@/components/shared/truncated-text";
import { avatarTint } from "../avatar-tint";
import { formatCattleAge } from "../format";
import { ANIMAL_CATEGORY_VARIANT } from "../utils/animal-category-style";
import { NextEventCell } from "./next-event-cell";
import type {
  CattleListItem,
  HealthStatusFilter,
  LactationStage,
  ProductionStatus,
  ReproductiveStatus,
} from "../types";

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

const LACTATION_STAGE_VARIANT: Record<LactationStage, ChipProps["variant"]> = {
  FRESH: "primary",
  EARLY: "primary",
  MID: "info",
  LATE: "warning",
  DRY_PERIOD: "muted",
};

/** Chip colors for the new dedicated "Reproduction status" column (see the doc comment on
 * `buildCattleColumns` for why this column now exists). No prior chip mapping existed for the full
 * 5-value `ReproductiveStatus` enum anywhere in the codebase — `cattle-profile-card.tsx` only ever
 * collapsed it to a binary Positive/Negative pregnancy label — so this mapping is new, invented
 * here following the same `Record<Enum, ChipProps["variant"]>` pattern the two chip maps above
 * already use. `PREGNANT` mirrors `PRODUCTION_STATUS_VARIANT.MILKING` (primary = positive
 * headline state); `NOT_ELIGIBLE` is `muted` (not applicable, same treatment `ANIMAL_CATEGORY`
 * gives no non-applicable state but matches `Chip`'s own `muted` default); `OPEN` is `warning`
 * (needs a breeding action); `POSTPARTUM_WAITING`/`BRED_AWAITING_CONFIRMATION` are `info`
 * (in-progress, not yet actionable or confirmed). */
const REPRODUCTIVE_STATUS_VARIANT: Record<ReproductiveStatus, ChipProps["variant"]> = {
  NOT_ELIGIBLE: "muted",
  POSTPARTUM_WAITING: "info",
  OPEN: "warning",
  BRED_AWAITING_CONFIRMATION: "info",
  PREGNANT: "primary",
};

/** Chip colors for the new dedicated "Health status" column — `healthStatus` had zero table
 * representation before this change (filter-only, per the old doc comment below). Variant choices
 * mirror the same positive/restrictive logic `MILK_ELIGIBILITY_VARIANT` in
 * `cattle-profile-card.tsx` already uses for its analogous saleable/withheld states: `HEALTHY` is
 * `primary` (good), `SICK`/`QUARANTINE` are `destructive` (active problem / isolation), and
 * `IN_TREATMENT`/`WITHHOLDING` are `warning` (recovering / temporarily restricted, not a fresh
 * problem). */
const HEALTH_STATUS_VARIANT: Record<HealthStatusFilter, ChipProps["variant"]> = {
  HEALTHY: "primary",
  SICK: "destructive",
  IN_TREATMENT: "warning",
  WITHHOLDING: "warning",
  QUARANTINE: "destructive",
};

/** `HealthStatusFilter`'s wire values don't lower-camelCase mechanically (`IN_TREATMENT`), so this
 * maps each to the existing `cattle.healthOptions.*` i18n keys (already used by the Health filter
 * dropdown) rather than inventing new translation keys for the same five labels. */
const HEALTH_STATUS_I18N_KEY: Record<HealthStatusFilter, string> = {
  HEALTHY: "healthy",
  SICK: "sick",
  IN_TREATMENT: "inTreatment",
  WITHHOLDING: "withholding",
  QUARANTINE: "quarantine",
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
 * Column set. Originally pixel-matched to the Figma "Cattle" table (Name/Breed/Age/Weight/Shed/AQR
 * Score/Status/Action, 8 columns, one combined "Status" cell folding `productionStatus` and the
 * `reproductionAlerts` indicator together) — that constraint is **deliberately superseded** per
 * explicit user request: each status dimension now gets its own column so `productionStatus`,
 * `reproductiveStatus`, and `healthStatus` are each independently visible and scannable, rather
 * than two of the three being buried behind a filter/detail-view-only presence. The table now runs
 * wider than the original 8-column Figma frame; `CattleTable`'s wrapper relies on the shared
 * `Table` UI primitive's built-in `overflow-x-auto` (see `@rakhal/ui/ui/table`) for horizontal
 * scroll on narrow viewports rather than any new column-hiding/truncation logic. Figma's own mock
 * "Status" values (e.g. "Active Breeder") never mapped to any real field this backend has —
 * `productionStatus` (RAKHAL-269 v2: trimmed to Milking/Dry, nullable) remains the real closest
 * match for the "Production status" column.
 */
export function buildCattleColumns(
  t: (key: string, values?: Record<string, string | number | Date>) => string,
  rowActions?: {
    onView?: (cattle: CattleListItem) => void;
  },
): ColumnDef<CattleListItem, unknown>[] {
  return [
    {
      id: "cattle",
      header: t("columns.cattle"),
      cell: ({ row }) => {
        const cattle = row.original;
        return (
          <div className="flex items-center gap-2 text-left">
            <CattleThumbnail cattle={cattle} />
            <span className="flex min-w-0 max-w-[16rem] flex-col gap-0.5">
              <TruncatedText className="text-sm font-medium text-foreground">{cattle.name ?? cattle.tagNumber}</TruncatedText>
              <span className="flex min-w-0 items-center gap-1">
                {/* The tag is the title when the animal has no name (or the same name) — don't print it twice. */}
                <TruncatedText className="text-xs text-muted-foreground">
                  {[cattle.name && cattle.name !== cattle.tagNumber ? cattle.tagNumber : null, cattle.breed?.name]
                    .filter(Boolean)
                    .join(" · ")}
                </TruncatedText>
                <GenderGlyph gender={cattle.gender} />
              </span>
            </span>
          </div>
        );
      },
    },
    {
      // RFE-151 — the single most urgent upcoming event + a popover with the rest. Sits right after the animal
      // so "who needs me soon" reads first; Breed moved under the name above to keep the table's width.
      id: "nextEvent",
      header: t("columns.nextEvent"),
      cell: ({ row }) => <NextEventCell cattle={row.original} onView={rowActions?.onView ?? (() => {})} />,
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
      header: t("columns.productionStatus"),
      cell: ({ row }) => {
        const status = row.original.productionStatus;
        return status ? (
          <Chip variant={PRODUCTION_STATUS_VARIANT[status]}>{t(`statusOptions.${status.toLowerCase()}`)}</Chip>
        ) : (
          "—"
        );
      },
    },
    {
      id: "lactationStage",
      header: t("columns.lactationStage"),
      cell: ({ row }) => {
        const stage = row.original.lactationStage;
        return stage ? (
          <Chip variant={LACTATION_STAGE_VARIANT[stage]}>{t(`lactationStageOptions.${stage}`)}</Chip>
        ) : (
          "—"
        );
      },
    },
    {
      id: "reproductiveStatus",
      header: t("columns.reproductionStatus"),
      cell: ({ row }) => {
        const status = row.original.reproductiveStatus;
        return (
          <span className="flex items-center gap-1.5">
            {status ? (
              <Chip variant={REPRODUCTIVE_STATUS_VARIANT[status]}>{t(`statusDialog.reproductiveOptions.${status}`)}</Chip>
            ) : (
              "—"
            )}
            <ReproductionAlertsIndicator alerts={row.original.reproductionAlerts} t={t} />
          </span>
        );
      },
    },
    {
      id: "healthStatus",
      header: t("columns.healthStatus"),
      cell: ({ row }) => {
        const status = row.original.healthStatus;
        return <Chip variant={HEALTH_STATUS_VARIANT[status]}>{t(`healthOptions.${HEALTH_STATUS_I18N_KEY[status]}`)}</Chip>;
      },
    },
  ];
}
