"use client"; // reads tanks query state

import { useTranslations } from "next-intl";
import { Milk, MilkOff } from "lucide-react";
import type { MilkTank } from "../types";

/**
 * "Statistics" panel — Figma 734:27948 ("KPI 3" 734:27952 + "KPI 8" 734:27970). **Real gap vs the
 * mock, flagged not faked**: the mock's breakdown rows ("Own Herd Production" vs "Outsourced
 * Purchase") and the second KPI ("Calf Feed Pool" / "Today's Consumption") have zero backing data
 * anywhere in this schema — `MilkTank` tracks per-tank volume only, never a source-of-milk or
 * calf-feed-allocation concept (see `types.ts` doc comment). Kept the one real KPI ("Total Milk
 * Stock", a genuine sum of every tank's `currentVolumeL`) and replaced the fabricated breakdown with
 * a real Sellable-vs-Withholding volume split of that same total instead of inventing numbers;
 * dropped the second "Calf Feed Pool" card entirely rather than render an empty/fake tile.
 */
export function MilkStatsCard({ tanks }: { tanks: MilkTank[] }) {
  const t = useTranslations("inventory.milk.stats");

  const totalStockL = tanks.reduce((sum, tank) => sum + tank.currentVolumeL, 0);
  const sellableL = tanks.filter((tank) => tank.tankType === "SELLABLE").reduce((sum, tank) => sum + tank.currentVolumeL, 0);
  const withholdingL = tanks.filter((tank) => tank.tankType === "WITHHOLDING").reduce((sum, tank) => sum + tank.currentVolumeL, 0);

  return (
    <div className="flex h-full flex-col gap-6 rounded-2xl bg-card p-4 shadow-[0px_0px_3px_rgba(0,0,0,0.1)]">
      <p className="text-xl font-bold text-foreground">{t("title")}</p>
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-5 rounded-xl border border-border p-4">
          <span className="flex size-10 items-center justify-center rounded-lg bg-success-tint text-success shadow-sm">
            <Milk className="size-6" aria-hidden />
          </span>
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-muted-foreground">{t("totalMilkStock")}</span>
              <span className="text-xl font-bold text-foreground">{t("litreValue", { value: totalStockL })}</span>
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                  <Milk className="size-4 text-info" aria-hidden />
                  {t("sellable")}
                </span>
                <span className="text-base font-bold text-foreground">{t("litreValue", { value: sellableL })}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 text-xs font-bold text-muted-foreground">
                  <MilkOff className="size-4 text-warning" aria-hidden />
                  {t("withholding")}
                </span>
                <span className="text-base font-bold text-foreground">{t("litreValue", { value: withholdingL })}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
