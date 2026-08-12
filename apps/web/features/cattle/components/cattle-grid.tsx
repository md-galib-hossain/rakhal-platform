"use client"; // interactive card grid (view/select actions)

import { useTranslations } from "next-intl";
import { CalendarDays, Mars, MapPin, Scale, TriangleAlert, Venus } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Chip, type ChipProps } from "@/components/ui/chip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { SelectableCardOverlay } from "@/components/shared/selectable-card-overlay";
import { avatarTint } from "../avatar-tint";
import { formatCattleAge } from "../format";
import { CattleRowActions } from "./cattle-row-actions";
import type {
  AnimalCategory,
  CattleListItem,
  HealthStatusFilter,
  LactationStage,
  ProductionStatus,
  ReproductiveStatus,
} from "../types";

// Chip color maps duplicated from `cattle-columns.tsx` rather than imported — that file's maps
// are module-private (not exported) and this card needs the exact same status→color meaning the
// table already established, not a new mapping to keep consistent by hand.
const PRODUCTION_STATUS_VARIANT: Record<ProductionStatus, ChipProps["variant"]> = {
  MILKING: "primary",
  DRY: "warning",
};
const ANIMAL_CATEGORY_VARIANT: Record<AnimalCategory, ChipProps["variant"]> = {
  CALF: "info",
  HEIFER: "purple",
  COW: "primary",
  BULL: "indigo",
  STEER: "teal",
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
    onEdit: (cattle: CattleListItem) => void;
    onChangeStatus: (cattle: CattleListItem) => void;
    onArchive: (cattle: CattleListItem) => void;
  };
}) {
  const t = useTranslations("cattle");
  const initial = (cattle.name ?? cattle.tagNumber).charAt(0).toUpperCase();

  return (
    <div className="flex w-full flex-col gap-2.5 rounded-2xl bg-card p-2 shadow-card">
      <div className="relative h-[110px] w-full shrink-0 rounded-xl">
        <button
          type="button"
          onClick={() => rowActions.onView(cattle)}
          className="absolute inset-0 cursor-pointer overflow-hidden rounded-xl text-left"
        >
          {cattle.profile_photo ? (
            <Avatar className="size-full rounded-xl">
              <AvatarImage src={cattle.profile_photo.thumb_url} alt="" className="rounded-xl object-cover" />
              <AvatarFallback className={cn("rounded-xl text-2xl", avatarTint(cattle.id))}>{initial}</AvatarFallback>
            </Avatar>
          ) : (
            <div className={cn("flex size-full items-center justify-center text-2xl font-semibold", avatarTint(cattle.id))}>
              {initial}
            </div>
          )}
        </button>

        <div className="absolute right-2 top-2 z-10">
          <CattleRowActions
            cattle={cattle}
            onView={rowActions.onView}
            onEdit={rowActions.onEdit}
            onChangeStatus={rowActions.onChangeStatus}
            onArchive={rowActions.onArchive}
          />
        </div>

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex flex-wrap items-center gap-1.5">
          <Chip variant={ANIMAL_CATEGORY_VARIANT[cattle.animalCategory]}>{t(`animalCategory.${cattle.animalCategory}`)}</Chip>
          {cattle.productionStatus ? (
            <Chip variant={PRODUCTION_STATUS_VARIANT[cattle.productionStatus]}>
              {t(`statusOptions.${cattle.productionStatus.toLowerCase()}`)}
            </Chip>
          ) : null}
        </div>
      </div>

      <div className="flex w-full flex-col gap-3 px-1.5 pb-1.5">
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-lg font-bold text-foreground">{cattle.name ?? cattle.tagNumber}</span>
            <GenderGlyph gender={cattle.gender} />
          </span>
          <span className="text-xs text-muted-foreground">
            {cattle.tagNumber} {cattle.breed?.name ? `· ${cattle.breed.name}` : ""}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden />
              {t("columns.age")}
            </span>
            <span className="text-sm font-medium text-muted-foreground">{formatCattleAge(cattle.dateOfBirth, t)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Scale className="size-4" aria-hidden />
              {t("columns.weight")}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              {cattle.lastWeightKg != null ? `${cattle.lastWeightKg} kg` : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="size-4" aria-hidden />
              {t("columns.shed")}
            </span>
            <span className="text-sm font-medium text-muted-foreground">{cattle.shed?.name ?? "—"}</span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-card p-2 shadow-card">
          <span className="text-base font-medium text-muted-foreground">{t("columns.aqr")}</span>
          <span className="flex items-baseline gap-1">
            <span className="text-[28px] font-bold leading-none text-primary">{cattle.aqrScore ?? "—"}</span>
            {cattle.aqrScore != null ? <span className="text-sm font-medium text-muted-foreground">/100</span> : null}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
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
    onEdit: (cattle: CattleListItem) => void;
    onChangeStatus: (cattle: CattleListItem) => void;
    onArchive: (cattle: CattleListItem) => void;
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
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {isLoading && items.length === 0
        ? Array.from({ length: 6 }, (_, i) => <div key={i} className="h-[420px] animate-pulse rounded-2xl bg-muted" />)
        : items.map((cattle) => (
            <SelectableCardOverlay
              key={cattle.id}
              canSelect={canSelect}
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
