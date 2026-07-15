"use client"; // action button callbacks

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { Button } from "@/components/ui/button";
import type { SemenTank } from "../types";

/** Straw-stock-vs-capacity ratio below which a tank reads as needing a refill — see `types.ts`'s
 * `SemenTankStatus` doc comment for why this is a derived heuristic, not a stored field. */
const REFILL_THRESHOLD = 0.2;

function tankStatus(tank: SemenTank): "stable" | "needsRefill" {
  const pct = tank.strawCapacity > 0 ? tank.strawInStock / tank.strawCapacity : 0;
  return pct < REFILL_THRESHOLD ? "needsRefill" : "stable";
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
 * "Semen Tank" card — Figma "Inventory - Semen" 732:20158 (nodes 734:25214/734:25215): title +
 * status chip, "Located at {storageLocation}" subtitle, a straw-capacity progress bar, then Current
 * Temp/LN2 Level tiles. The mock's decorative tank illustration (`imgFrame1267`/`imgFrame1268`,
 * static exported assets with a fixed mock fill, URLs expiring after 7 days) is dropped in favor of
 * the real data already shown in the progress bar — same call `MilkTankCard` made for its own
 * Figma-exported bottle asset.
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
          <p className="truncate text-xl font-bold text-foreground">{tank.name}</p>
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

      <div className="flex w-full gap-4">
        <MetricTile label={t("currentTemp")} value={tank.currentTempC != null ? `${tank.currentTempC}` : "—"} />
        <MetricTile label={t("ln2Level")} value={tank.ln2LevelPct != null ? `${tank.ln2LevelPct}%` : "—"} />
      </div>

      <Button type="button" variant="secondary" size="sm" className="w-full" onClick={() => onOpenDetails(tank)}>
        {t("viewDetails")}
      </Button>
    </div>
  );
}
