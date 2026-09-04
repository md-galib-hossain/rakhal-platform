"use client"; // action button callbacks + mutation

import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError } from "@/lib/api/errors";
import { Button } from "@/components/ui/button";
import { useSetPrimaryMilkTank } from "../hooks/use-inventory";
import type { MilkTank } from "../types";

/**
 * Simplified milk-bottle fill gauge — Figma's "Tank" component (734:27946/734:27947) uses a
 * bespoke multi-layer bottle SVG (cap + shoulder + wavy liquid surface) exported as static image
 * assets with a fixed 700/1200L mock fill baked in. Those Figma asset URLs expire after 7 days
 * (same constraint noted on the auth hero photo) and, more importantly, are a fixed mock fill —
 * every real tank has a different `fillPct`. Rebuilt as a plain data-driven gauge (rounded "bottle"
 * silhouette + a bottom-anchored fill div sized to the real `fillPct`) instead of hardcoding one
 * fill level, reusing existing `info`/`warning` tokens for the two tank-type colors (no new colors
 * added) rather than re-hosting the exact Figma gradient.
 */
function MilkBottleGauge({ tankType, currentVolumeL, fillPct }: { tankType: MilkTank["tankType"]; currentVolumeL: number; fillPct: number }) {
  const t = useTranslations("inventory.milk.tankCard");
  const isSellable = tankType === "SELLABLE";

  return (
    <div className="relative h-[200px] w-[101px] shrink-0 overflow-hidden rounded-b-[28px] rounded-t-md border border-border bg-muted">
      <div className="absolute inset-x-[32%] top-0 h-3.5 rounded-t-sm bg-border" />
      <div
        className={cn("absolute inset-x-0 bottom-0 rounded-b-[26px] transition-[height] duration-500", isSellable ? "bg-info/70" : "bg-warning/60")}
        style={{ height: `${Math.min(100, Math.max(0, fillPct))}%` }}
      />
      <div className="absolute inset-x-2 bottom-2.5 flex flex-col items-center gap-0.5 text-center">
        <span className={cn("text-xl font-bold", isSellable ? "text-info" : "text-warning")}>{currentVolumeL}L</span>
        <span className="text-xs text-muted-foreground">{t("totalMilk")}</span>
      </div>
    </div>
  );
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col justify-between gap-2 rounded-lg bg-muted p-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xl font-bold text-foreground">{value}</span>
    </div>
  );
}

/**
 * Figma "Tank" card (734:27946 Sellable / 734:27947 Withholding) — 2-color diagonal ribbon badge
 * (blue "Sellable" / amber "Withholding"), fat/protein/snf tiles, the bottle gauge above, and the
 * Sync-to-Physical + Route action buttons. `onRoute` is a plain deep link to Buyers & Dispatch
 * (`/buyers`) — the mock's "Route/Sell"/"Route/Resolve" CTAs imply a pre-filled dispatch flow keyed
 * to this specific tank, which doesn't exist yet (that module has no tank-selection step); flagged,
 * not faked, as a bare navigation instead.
 */
export function MilkTankCard({ tank, onSync }: { tank: MilkTank; onSync: (tank: MilkTank) => void }) {
  const t = useTranslations("inventory.milk.tankCard");
  const isSellable = tank.tankType === "SELLABLE";
  const setPrimary = useSetPrimaryMilkTank();

  async function handleMakePrimary() {
    try {
      await setPrimary.mutateAsync(tank.id);
      toast.success(t("primarySetToast", { name: tank.name, type: isSellable ? t("badgeSellable") : t("badgeWithholding") }));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("primarySetError"));
    }
  }

  return (
    <div className="relative overflow-hidden rounded-2xl bg-card p-4 shadow-[0px_0px_6px_0px_rgba(0,0,0,0.1)]">
      <div
        className={cn(
          "absolute -right-6 -top-5 flex w-[116px] rotate-[38deg] items-center justify-center px-2.5 py-1.5 text-center text-[10px] font-bold shadow-sm",
          isSellable ? "bg-info-tint text-info" : "bg-warning-tint text-warning",
        )}
      >
        {isSellable ? t("badgeSellable") : t("badgeWithholding")}
      </div>

      <div className="flex items-end gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <p className="truncate text-xl font-bold text-foreground">{tank.name}</p>
              {tank.isPrimary ? (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success-tint px-2 py-0.5 text-[10px] font-semibold text-success">
                  <Star className="size-3 shrink-0 fill-current" aria-hidden />
                  {t("primaryBadge")}
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">{t("totalCapacity", { value: tank.totalCapacityL })}</p>
          </div>
          <div className="flex flex-1 flex-col gap-3">
            <MetricTile label={t("fat")} value={tank.fatPct != null ? `${tank.fatPct}%` : "—"} />
            <div className="flex gap-3">
              <MetricTile label={t("protein")} value={tank.proteinPct != null ? `${tank.proteinPct}%` : "—"} />
              <MetricTile label={t("snf")} value={tank.snfPct != null ? `${tank.snfPct}%` : "—"} />
            </div>
          </div>
        </div>
        <MilkBottleGauge tankType={tank.tankType} currentVolumeL={tank.currentVolumeL} fillPct={tank.fillPct} />
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
        <Button type="button" variant="outline" size="sm" className="h-8 flex-1 text-xs" onClick={() => onSync(tank)}>
          {t("syncToPhysical")}
        </Button>
        <Button
          asChild
          size="sm"
          className={cn("h-8 flex-1 text-xs text-white", isSellable ? "bg-info hover:bg-info/90" : "bg-warning hover:bg-warning/90")}
        >
          <a href="/buyers">{isSellable ? t("routeSell") : t("routeResolve")}</a>
        </Button>
      </div>
    </div>
  );
}
