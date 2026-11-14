"use client"; // interactive card grid (view/select actions)

import { useTranslations } from "next-intl";
import { CalendarClock, CalendarDays, Mars, MapPin, Scale, TriangleAlert, Venus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@rakhal/ui/ui/avatar";
import { Chip, type ChipProps } from "@rakhal/ui/ui/chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@rakhal/ui/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { SelectableCardOverlay } from "@/components/shared/selectable-card-overlay";
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

// Chip color map duplicated from `cattle-columns.tsx` rather than imported — that file's other
// maps are module-private (not exported) and this card needs the exact same status→color meaning
// the table already established, not a new mapping to keep consistent by hand.
// `ANIMAL_CATEGORY_VARIANT` itself is shared (RAKHAL-402) via `../utils/animal-category-style`.
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
const REPRODUCTIVE_STATUS_VARIANT: Record<ReproductiveStatus, ChipProps["variant"]> = {
  NOT_ELIGIBLE: "muted",
  POSTPARTUM_WAITING: "info",
  OPEN: "warning",
  BRED_AWAITING_CONFIRMATION: "info",
  PREGNANT: "primary",
};
const HEALTH_STATUS_VARIANT: Record<HealthStatusFilter, ChipProps["variant"]> = {
  HEALTHY: "primary",
  SICK: "destructive",
  IN_TREATMENT: "warning",
  WITHHOLDING: "warning",
  QUARANTINE: "destructive",
};
const HEALTH_STATUS_I18N_KEY: Record<HealthStatusFilter, string> = {
  HEALTHY: "healthy",
  SICK: "sick",
  IN_TREATMENT: "inTreatment",
  WITHHOLDING: "withholding",
  QUARANTINE: "quarantine",
};

function GenderGlyph({ gender }: { gender: CattleListItem["gender"] }) {
  if (gender === "FEMALE") return <Venus className="size-3.5 text-accent-pink" aria-hidden />;
  return <Mars className="size-3.5 text-info" aria-hidden />;
}

/** RAKHAL-042's still-open "cards (mobile default)" acceptance criterion — same anatomy as
 * `FeedItemCard` (`features/inventory/components/feed-item-grid.tsx`): tinted avatar slot, kebab
 * row-actions overlay, label/value rows, one highlighted stat block. Data + actions are the exact
 * same set `cattle-columns.tsx` renders per table row — this is an alternate presentation of the
 * same list, not a reduced one, since the table is the one being replaced on mobile, not
 * supplemented. */
function CattleCard({
  cattle,
  rowActions,
}: {
  cattle: CattleListItem;
  rowActions: {
    onView: (cattle: CattleListItem) => void;
  };
}) {
  const t = useTranslations("cattle");
  const initial = (cattle.name ?? cattle.tagNumber).charAt(0).toUpperCase();
  const hasDistinctName = Boolean(
    cattle.name && cattle.name.trim().toLowerCase() !== cattle.tagNumber.trim().toLowerCase(),
  );
  const title = hasDistinctName ? cattle.name! : cattle.tagNumber;
  const subtitle = hasDistinctName
    ? `${cattle.tagNumber}${cattle.breed?.name ? ` · ${cattle.breed.name}` : ""}`
    : (cattle.breed?.name ?? "");

  return (
    <div className="flex h-full w-full flex-col justify-between gap-2.5 rounded-2xl bg-card p-2 shadow-card transition-shadow hover:shadow-md">
      <div className="flex flex-col gap-2.5">
        <div className="relative h-[116px] w-full shrink-0 overflow-hidden rounded-xl border border-border/40 bg-muted/40">
          <button
            type="button"
            onClick={() => rowActions.onView(cattle)}
            className="absolute inset-0 cursor-pointer overflow-hidden rounded-xl text-left"
          >
            {cattle.profile_photo ? (
              <div className="relative size-full">
                <Avatar className="size-full rounded-xl">
                  <AvatarImage src={cattle.profile_photo.thumb_url} alt="" className="size-full rounded-xl object-cover" />
                  <AvatarFallback className={cn("rounded-xl text-2xl", avatarTint(cattle.id))}>{initial}</AvatarFallback>
                </Avatar>
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
              </div>
            ) : (
              <div className="flex size-full items-center justify-center bg-gradient-to-b from-muted/60 to-muted/20">
                <div
                  className={cn(
                    "flex size-14 items-center justify-center rounded-2xl border border-border/60 text-xl font-bold shadow-xs",
                    avatarTint(cattle.id),
                  )}
                >
                  {initial}
                </div>
              </div>
            )}
          </button>

          <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap items-center gap-1.5">
            <Chip variant={ANIMAL_CATEGORY_VARIANT[cattle.animalCategory]}>{t(`animalCategory.${cattle.animalCategory}`)}</Chip>
            {cattle.productionStatus ? (
              <Chip variant={PRODUCTION_STATUS_VARIANT[cattle.productionStatus]}>
                {t(`statusOptions.${cattle.productionStatus.toLowerCase()}`)}
              </Chip>
            ) : null}
          </div>
        </div>

        <div className="flex w-full flex-col gap-3 px-1.5 pb-1">
          <button
            type="button"
            onClick={() => rowActions.onView(cattle)}
            className="flex flex-col gap-0.5 text-left transition-opacity hover:opacity-80"
          >
            <span className="flex items-center gap-1.5">
              <span className="truncate text-lg font-bold text-foreground hover:underline">{title}</span>
              <GenderGlyph gender={cattle.gender} />
            </span>
            <span className="block min-h-[16px] truncate text-xs text-muted-foreground">
              {subtitle || "\u00A0"}
            </span>
          </button>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarDays className="size-3.5 text-muted-foreground/70" aria-hidden />
                {t("columns.age")}
              </span>
              <span className="text-sm font-medium text-foreground">{formatCattleAge(cattle.dateOfBirth, t)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Scale className="size-3.5 text-muted-foreground/70" aria-hidden />
                {t("columns.weight")}
              </span>
              <span className="text-sm font-medium text-foreground">
                {cattle.lastWeightKg != null ? `${cattle.lastWeightKg} kg` : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="size-3.5 text-muted-foreground/70" aria-hidden />
                {t("columns.shed")}
              </span>
              <span className="text-sm font-medium text-foreground">{cattle.shed?.name ?? "—"}</span>
            </div>
            <div className="flex min-h-[24px] items-center justify-between gap-2">
              <span className="flex shrink-0 items-center gap-1.5 text-sm text-muted-foreground">
                <CalendarClock className="size-3.5 text-muted-foreground/70" aria-hidden />
                {t("columns.nextEvent")}
              </span>
              {cattle.next_event ? (
                <NextEventCell cattle={cattle} onView={rowActions.onView} />
              ) : (
                <span className="text-sm font-medium text-muted-foreground">—</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 px-1.5 pb-1">
        <div className="flex items-center justify-between rounded-xl border border-border/60 bg-muted/40 px-3 py-2">
          <span className="text-sm font-medium text-muted-foreground">{t("columns.aqr")}</span>
          <span className="flex items-baseline gap-1">
            <span className="text-2xl font-bold leading-none text-primary tabular-nums">{cattle.aqrScore ?? "—"}</span>
            {cattle.aqrScore != null ? <span className="text-xs font-medium text-muted-foreground">/100</span> : null}
          </span>
        </div>

        <div className="flex min-h-[26px] flex-wrap items-center gap-1.5 pt-0.5">
          {cattle.lactationStage ? (
            <Chip variant={LACTATION_STAGE_VARIANT[cattle.lactationStage]}>{t(`lactationStageOptions.${cattle.lactationStage}`)}</Chip>
          ) : null}
          {cattle.reproductiveStatus ? (
            <Chip variant={REPRODUCTIVE_STATUS_VARIANT[cattle.reproductiveStatus]}>
              {t(`statusDialog.reproductiveOptions.${cattle.reproductiveStatus}`)}
            </Chip>
          ) : null}
          <Chip variant={HEALTH_STATUS_VARIANT[cattle.healthStatus]}>
            {t(`healthOptions.${HEALTH_STATUS_I18N_KEY[cattle.healthStatus]}`)}
          </Chip>
          {cattle.reproductionAlerts.length > 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className="inline-flex items-center gap-0.5 text-warning"
                  aria-label={t("reproductionAlerts.count", { count: cattle.reproductionAlerts.length })}
                >
                  <TriangleAlert className="size-3.5" aria-hidden />
                  <span className="text-xs font-semibold">{cattle.reproductionAlerts.length}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>
                <ul className="flex flex-col gap-0.5">
                  {cattle.reproductionAlerts.map((alert) => (
                    <li key={alert}>{t(`reproductionAlerts.${alert}`)}</li>
                  ))}
                </ul>
              </TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Card grid view — RAKHAL-042's "cards (mobile default)" AC. Same data/actions/bulk-selection as
 * `CattleTable`, toggled by the parent (view state + mobile default seeded there via
 * `useMediaQuery`), not a separate query. */
export function CattleGrid({
  items,
  isLoading,
  isError,
  onRetry,
  rowActions,
  canSelect,
  isSelected,
  onToggleSelect,
}: {
  items: CattleListItem[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  rowActions: {
    onView: (cattle: CattleListItem) => void;
  };
  canSelect: boolean;
  isSelected: (id: string) => boolean;
  onToggleSelect: (id: string) => void;
}) {
  const t = useTranslations("cattle");

  if (isError) return <ErrorState onRetry={onRetry} />;
  if (!isLoading && items.length === 0) {
    return <EmptyState title={t("empty.title")} description={t("empty.description")} />;
  }

  return (
    <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {isLoading && items.length === 0
        ? Array.from({ length: 8 }, (_, i) => <div key={i} className="h-[420px] animate-pulse rounded-2xl bg-muted" />)
        : items.map((cattle) => (
            <SelectableCardOverlay
              key={cattle.id}
              canSelect={canSelect}
              position="top-right"
              selected={isSelected(cattle.id)}
              onToggleSelect={() => onToggleSelect(cattle.id)}
              label={t("bulk.selectCard", { name: cattle.name ?? cattle.tagNumber })}
            >
              <CattleCard cattle={cattle} rowActions={rowActions} />
            </SelectableCardOverlay>
          ))}
    </div>
  );
}
