"use client"; // action button callbacks + mutation

import { useId } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { useSetPrimaryMilkTank } from "../hooks/use-inventory";
import type { MilkTank } from "../types";

/**
 * Milk bottle fill gauge — matches Figma's milk container design (734:27946/734:27947).
 * Rendered with an SVG milk bottle silhouette (top cap/rim resting on the neck,
 * tapered shoulders, rounded base) and dynamic wavy liquid fill driven by `fillPct`.
 */
function MilkBottleGauge({
  tankType,
  currentVolumeL,
  fillPct,
}: {
  tankType: MilkTank["tankType"];
  currentVolumeL: number;
  fillPct: number;
}) {
  const t = useTranslations("inventory.milk.tankCard");
  const rawId = useId();
  const clipId = `bottle-clip-${rawId.replace(/:/g, "")}`;
  const isSellable = tankType === "SELLABLE";

  // Clamp percentage between 0 and 100
  const clampedPct = Math.min(100, Math.max(0, fillPct));
  // Usable bottle fill height: bottom is at y=168, 100% capacity is at y=44
  const fillHeight = (clampedPct / 100) * 124;
  const liquidY = 168 - fillHeight;

  // Milk bottle outline path
  const bottlePath =
    "M 34 13 L 34 24 C 34 38 8 38 8 52 L 8 154 C 8 164 16 168 24 168 L 76 168 C 84 168 92 164 92 154 L 92 52 C 92 38 66 38 66 24 L 66 13 Z";

  // Wavy liquid surface
  const wavePath =
    clampedPct <= 0
      ? ""
      : clampedPct >= 98
        ? `M 0 ${liquidY} L 100 ${liquidY} L 100 170 L 0 170 Z`
        : `M 0 ${liquidY + 2} C 25 ${liquidY + 5}, 70 ${liquidY - 5}, 100 ${liquidY - 1} L 100 170 L 0 170 Z`;

  return (
    <div className="relative flex h-[185px] w-[96px] shrink-0 items-center justify-center sm:h-[195px] sm:w-[105px]">
      <svg
        viewBox="0 0 100 172"
        className="h-full w-full drop-shadow-xs"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={bottlePath} />
          </clipPath>
        </defs>

        {/* Bottle Body Background */}
        <path
          d={bottlePath}
          className="fill-muted/60 dark:fill-muted/30 stroke-border/60 dark:stroke-border"
          strokeWidth="1.5"
        />

        {/* Liquid Fill with Wave */}
        {clampedPct > 0 ? (
          <g clipPath={`url(#${clipId})`}>
            <path
              d={wavePath}
              className={cn(
                "transition-[d] duration-500",
                isSellable
                  ? "fill-[#A5C9FF] dark:fill-blue-500/40"
                  : "fill-[#FDE68A] dark:fill-amber-400/40",
              )}
            />
          </g>
        ) : null}

        {/* Bottle Neck/Body Inner Stroke for Crisp Border */}
        <path
          d={bottlePath}
          className="stroke-border/70 dark:stroke-border"
          strokeWidth="1.5"
          fill="none"
        />

        {/* Bottle Cap / Rim — cleanly on top of the neck */}
        <rect
          x="28"
          y="4"
          width="44"
          height="10"
          rx="4"
          className="fill-border/70 stroke-border dark:fill-muted dark:stroke-border"
          strokeWidth="1.5"
        />
      </svg>

      {/* Volume & Label Overlay */}
      <div className="pointer-events-none absolute inset-x-1 bottom-3 flex flex-col items-center justify-center text-center">
        <span
          className={cn(
            "text-lg font-bold tracking-tight sm:text-xl",
            isSellable ? "text-info dark:text-blue-400" : "text-warning dark:text-amber-400",
          )}
        >
          {currentVolumeL}L
        </span>
        <span className="text-[10px] font-medium text-muted-foreground sm:text-xs">
          {t("totalMilk")}
        </span>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-1.5 rounded-lg bg-muted/80 p-2.5 dark:bg-muted/40 sm:p-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <span className="text-lg font-bold text-foreground sm:text-xl">{value}</span>
    </div>
  );
}

/**
 * Figma "Tank" card (734:27946 Sellable / 734:27947 Withholding) — 2-color diagonal ribbon badge
 * (blue "Sellable" / amber "Withholding"), fat/protein/snf tiles, the bottle gauge above, and the
 * Sync-to-Physical + Route action buttons.
 */
export function MilkTankCard({
  tank,
  onSync,
}: {
  tank: MilkTank;
  onSync: (tank: MilkTank) => void;
}) {
  const t = useTranslations("inventory.milk.tankCard");
  const isSellable = tank.tankType === "SELLABLE";
  const setPrimary = useSetPrimaryMilkTank();

  async function handleMakePrimary() {
    try {
      await setPrimary.mutateAsync(tank.id);
      toast.success(
        t("primarySetToast", {
          name: tank.name,
          type: isSellable ? t("badgeSellable") : t("badgeWithholding"),
        }),
      );
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("primarySetError"));
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card p-4 shadow-[0px_0px_6px_0px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0px_2px_8px_0px_rgba(0,0,0,0.12)]">
      {/* Non-cropping diagonal corner ribbon badge */}
      <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 overflow-hidden rounded-tr-2xl">
        <div
          className={cn(
            "absolute right-[-32px] top-[14px] w-[115px] rotate-45 py-1 text-center text-[10px] font-bold tracking-wide shadow-2xs",
            isSellable ? "bg-info-tint text-info" : "bg-warning-tint text-warning",
          )}
        >
          {isSellable ? t("badgeSellable") : t("badgeWithholding")}
        </div>
      </div>

      <div className="flex items-end gap-3 sm:gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 pr-14">
              <p className="truncate text-lg font-bold text-foreground sm:text-xl">{tank.name}</p>
              {tank.isPrimary ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-[10px] font-semibold text-success">
                  <Star className="size-3 shrink-0 fill-current" aria-hidden />
                  {t("primaryBadge")}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("totalCapacity", { value: tank.totalCapacityL })}
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-2.5 sm:gap-3">
            <MetricTile label={t("fat")} value={tank.fatPct != null ? `${tank.fatPct}%` : "—"} />
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <MetricTile
                label={t("protein")}
                value={tank.proteinPct != null ? `${tank.proteinPct}%` : "—"}
              />
              <MetricTile
                label={t("snf")}
                value={tank.snfPct != null ? `${tank.snfPct}%` : "—"}
              />
            </div>
          </div>
        </div>

        <MilkBottleGauge
          tankType={tank.tankType}
          currentVolumeL={tank.currentVolumeL}
          fillPct={tank.fillPct}
        />
      </div>

      <div className="mt-4 flex items-center gap-2">
        {tank.isPrimary ? null : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 shrink-0 px-2 text-xs"
            title={t("makePrimaryTooltip")}
            aria-label={t("makePrimary")}
            disabled={setPrimary.isPending}
            onClick={handleMakePrimary}
          >
            <Star className="size-3.5 shrink-0" aria-hidden />
          </Button>
        )}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 flex-1 truncate px-2 text-xs font-medium"
          onClick={() => onSync(tank)}
        >
          {t("syncToPhysical")}
        </Button>
        <Button
          asChild
          size="sm"
          className={cn(
            "h-8 flex-1 truncate px-2 text-xs font-medium text-white",
            isSellable ? "bg-info hover:bg-info/90" : "bg-warning hover:bg-warning/90",
          )}
        >
          <a href="/buyers">{isSellable ? t("routeSell") : t("routeResolve")}</a>
        </Button>
      </div>
    </div>
  );
}
