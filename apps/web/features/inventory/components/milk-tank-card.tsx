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
import { TruncatedText } from "@/components/shared/truncated-text";

/**
 * Milk bottle fill gauge — matches Figma's milk container design (734:27946/734:27947).
 * Rendered with high-resolution crisp SVG vector silhouette (top cap/rim resting on the neck,
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
  // Usable bottle fill height: bottom is at y=236, 100% capacity is at y=66
  const fillHeight = (clampedPct / 100) * 170;
  const liquidY = 236 - fillHeight;

  // High-resolution milk bottle outline vector path
  const bottlePath =
    "M 52 19 L 52 36 C 52 56 10 56 10 72 L 10 224 C 10 234 18 238 30 238 L 130 238 C 142 238 150 234 150 224 L 150 72 C 150 56 108 56 108 36 L 108 19 Z";

  // Crisp wavy liquid surface
  const wavePath =
    clampedPct <= 0
      ? ""
      : clampedPct >= 98
        ? `M 0 ${liquidY} L 160 ${liquidY} L 160 240 L 0 240 Z`
        : `M 0 ${liquidY + 3} C 40 ${liquidY + 8}, 115 ${liquidY - 8}, 160 ${liquidY - 2} L 160 240 L 0 240 Z`;

  return (
    <div className="relative flex h-[240px] w-[165px] shrink-0 items-end justify-center sm:h-[248px] sm:w-[205px]">
      <svg
        viewBox="0 0 160 240"
        className="h-full w-full"
        xmlns="http://www.w3.org/2000/svg"
        shapeRendering="geometricPrecision"
        aria-hidden="true"
      >
        <defs>
          <clipPath id={clipId}>
            <path d={bottlePath} />
          </clipPath>
          <linearGradient id={`cap-grad-${rawId.replace(/:/g, "")}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#EFF1F4" />
            <stop offset="100%" stopColor="#E2E6EA" />
          </linearGradient>
        </defs>

        {/* Authentic Light Milk Bottle Backdrop */}
        <path
          d={bottlePath}
          style={{ fill: "#F5F6F8", stroke: "#E2E6EA" }}
          strokeWidth="1.5"
        />

        {/* Liquid Fill with Wave */}
        {clampedPct > 0 ? (
          <g clipPath={`url(#${clipId})`}>
            <path
              d={wavePath}
              style={{ fill: isSellable ? "#A5C9FF" : "#FDE68A" }}
              className="transition-[d] duration-500"
            />
          </g>
        ) : null}

        {/* Smooth Bottle Outline */}
        <path
          d={bottlePath}
          fill="none"
          style={{ stroke: "#E2E6EA" }}
          strokeWidth="1.5"
        />

        {/* Realistic Rounded Milk Bottle Rim / Cap */}
        <rect
          x="44"
          y="6"
          width="72"
          height="14"
          rx="7"
          fill={`url(#cap-grad-${rawId.replace(/:/g, "")})`}
          style={{ stroke: "#E2E6EA" }}
          strokeWidth="1.5"
        />
      </svg>

      {/* Volume & Label Overlay */}
      <div className="pointer-events-none absolute inset-x-2 bottom-3.5 flex flex-col items-center justify-center text-center sm:bottom-4">
        <span
          className={cn(
            "text-2xl font-black tracking-tight sm:text-3xl",
            isSellable ? "text-blue-600" : "text-amber-600",
          )}
        >
          {currentVolumeL}L
        </span>
        <span className="text-xs font-semibold text-slate-500">
          {t("totalMilk")}
        </span>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-1.5 rounded-xl bg-muted/80 p-3 dark:bg-muted/40 sm:p-3.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <span className="text-xl font-bold text-foreground sm:text-2xl">{value}</span>
    </div>
  );
}

/**
 * Figma "Tank" card (734:27946 Sellable / 734:27947 Withholding) — 2-color diagonal ribbon badge
 * (blue "Sellable" / amber "Withholding"), fat/protein/snf tiles, the bottle gauge, and the
 * Sync-to-Physical + Route action buttons inside the left column.
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
      toast.success(t("primarySetToast", { name: tank.name }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("primarySetError"));
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card p-4.5 shadow-[0px_0px_6px_0px_rgba(0,0,0,0.08)] transition-shadow hover:shadow-[0px_2px_8px_0px_rgba(0,0,0,0.12)]">
      {/* Non-cropping diagonal corner ribbon badge */}
      <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 overflow-hidden rounded-tr-2xl">
        <div
          className={cn(
            "absolute right-[-32px] top-[14px] w-[115px] rotate-45 py-1 text-center text-xs font-bold tracking-wide shadow-2xs",
            isSellable ? "bg-info-tint text-info" : "bg-warning-tint text-warning",
          )}
        >
          {isSellable ? t("badgeSellable") : t("badgeWithholding")}
        </div>
      </div>

      <div className="flex items-end gap-3 sm:gap-5">
        {/* Left Column: Header, Metrics, and Action Buttons */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-3.5 sm:gap-4">
          {/* Header */}
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-1.5 pr-2">
              <TruncatedText className="text-lg font-bold text-foreground sm:text-xl">{tank.name}</TruncatedText>
              {tank.isPrimary ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-xs font-semibold text-success">
                  <Star className="size-3 shrink-0 fill-current" aria-hidden />
                  {t("primaryBadge")}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {t("totalCapacity", { value: tank.totalCapacityL })}
            </p>
          </div>

          {/* Metrics */}
          <div className="flex flex-col gap-2 sm:gap-3">
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

          {/* Action Buttons — strictly within the left column */}
          <div className="flex items-center gap-2">
            {tank.isPrimary ? null : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8.5 shrink-0 px-2.5 text-xs"
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
              className="h-8.5 flex-1 truncate px-2 text-xs font-medium"
              onClick={() => onSync(tank)}
            >
              {t("syncToPhysical")}
            </Button>
            <Button
              asChild
              size="sm"
              className={cn(
                "h-8.5 flex-1 truncate px-2 text-xs font-medium text-white",
                isSellable ? "bg-info hover:bg-info/90" : "bg-warning hover:bg-warning/90",
              )}
            >
              <a href="/sales?tab=buyers">{isSellable ? t("routeSell") : t("routeResolve")}</a>
            </Button>
          </div>
        </div>

        {/* Right Column: Flush bottom-aligned Milk Container Bottle */}
        <div className="flex shrink-0 items-end justify-center">
          <MilkBottleGauge
            tankType={tank.tankType}
            currentVolumeL={tank.currentVolumeL}
            fillPct={tank.fillPct}
          />
        </div>
      </div>
    </div>
  );
}
