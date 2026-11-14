"use client"; // action button callbacks

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Chip } from "@rakhal/ui/ui/chip";
import { Button } from "@rakhal/ui/ui/button";
import type { SemenTank } from "../types";
import { TruncatedText } from "@rakhal/ui/shared/truncated-text";

/** Straw-stock-vs-capacity ratio below which a tank reads as needing a refill — see `types.ts`'s
 * `SemenTankStatus` doc comment for why this is a derived heuristic, not a stored field. */
const REFILL_THRESHOLD = 0.2;

function tankStatus(tank: SemenTank): "stable" | "needsRefill" {
  const pct = tank.strawCapacity > 0 ? tank.strawInStock / tank.strawCapacity : 0;
  return pct < REFILL_THRESHOLD ? "needsRefill" : "stable";
}

/**
 * "Semen Tank" card — Figma "Inventory - Semen" 732:20158 (nodes 734:25214/734:25215): title +
 * status chip, "Located at {storageLocation}" subtitle, a straw-capacity progress bar.
 */
export function SemenTankCard({ tank, onOpenDetails }: { tank: SemenTank; onOpenDetails: (tank: SemenTank) => void }) {
  const t = useTranslations("inventory.semen.tankCard");
  const status = tankStatus(tank);
  const isStable = status === "stable";
  const fillPct = tank.strawCapacity > 0 ? Math.min(100, Math.max(0, (tank.strawInStock / tank.strawCapacity) * 100)) : 0;

  return (
    <div className="flex flex-col items-start gap-6 rounded-2xl bg-card p-4 shadow-[0px_0px_6px_0px_rgba(0,0,0,0.1)] transition-shadow hover:shadow-[0px_0px_10px_0px_rgba(0,0,0,0.15)]">
      <div className="flex w-full flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <TruncatedText className="text-xl font-bold text-foreground">{tank.name}</TruncatedText>
          <Chip variant={isStable ? "primary" : "warning"}>{isStable ? t("badgeStable") : t("badgeNeedsRefill")}</Chip>
        </div>
        <p className="text-xs text-muted-foreground">{tank.storageLocation ? t("locatedAt", { location: tank.storageLocation }) : t("noLocation")}</p>
      </div>

      <div className="flex w-full flex-col gap-2">
        <p className="text-xs text-muted-foreground">{t("totalStraw")}</p>
        <div className="flex flex-col gap-1">
          <p>
            <span className="text-3xl font-bold text-foreground">{tank.strawInStock}</span>
            <span className="text-xs text-muted-foreground">/{tank.strawCapacity}</span>
          </p>
          <div className={cn("h-2.5 w-full rounded-md", isStable ? "bg-info-tint" : "bg-warning-tint")}>
            <div
              className={cn("h-2.5 rounded-md transition-[width] duration-500", isStable ? "bg-info" : "bg-warning")}
              style={{ width: `${fillPct}%` }}
            />
          </div>
        </div>
      </div>

      <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => onOpenDetails(tank)}>
        {t("viewDetails")}
      </Button>
    </div>
  );
}
