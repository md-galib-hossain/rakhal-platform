"use client";

import { useTranslations } from "next-intl";
import { ArrowRightToLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Chip } from "@/components/ui/chip";
import { Button } from "@rakhal/ui/ui/button";
import type { SemenTank } from "../types";

const REFILL_THRESHOLD = 0.2;

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="text-xs font-bold text-muted-foreground">{label}</p>
      <p className="text-base text-foreground">{value}</p>
    </div>
  );
}

/**
 * Tank Details drawer — Figma "Tank Details" (732:22640, `get_design_context`): a read-only capacity
 * gauge + info card.
 */
export function SemenTankDetailsDialog({
  tank,
  onOpenChange,
}: {
  tank: SemenTank | undefined;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Sheet open={Boolean(tank)} onOpenChange={onOpenChange}>
      {tank ? <SemenTankDetailsDialogBody key={tank.id} tank={tank} onOpenChange={onOpenChange} /> : null}
    </Sheet>
  );
}

function SemenTankDetailsDialogBody({ tank, onOpenChange }: { tank: SemenTank; onOpenChange: (open: boolean) => void }) {
  const t = useTranslations("inventory.semen.tankDetails");
  const fillPct = tank.strawCapacity > 0 ? Math.min(100, Math.max(0, (tank.strawInStock / tank.strawCapacity) * 100)) : 0;
  const isStable = tank.strawCapacity > 0 ? tank.strawInStock / tank.strawCapacity >= REFILL_THRESHOLD : true;

  return (
    <SheetContent
      showClose={false}
      className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[680px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[680px]"
    >
      <div className="flex items-start justify-between pb-5">
        <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          aria-label={t("close")}
          className="flex size-5 shrink-0 items-center justify-center text-foreground transition-opacity hover:opacity-70"
        >
          <ArrowRightToLine className="size-5" aria-hidden />
        </button>
      </div>
      <div className="border-t border-dashed border-border" />

      <div className="flex min-h-0 flex-1 flex-col justify-between">
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-1 py-4">
          <div className="flex items-center gap-4">
            <div className="flex h-[280px] w-[140px] shrink-0 flex-col items-center justify-center gap-3 rounded-2xl border border-border p-3">
              <Chip variant={isStable ? "primary" : "warning"}>{isStable ? t("badgeStable") : t("badgeNeedsRefill")}</Chip>
              <div className="relative h-[200px] w-[101px] overflow-hidden rounded-b-[26px] rounded-t-md border border-border bg-muted">
                <div
                  className={cn("absolute inset-x-0 bottom-0 rounded-b-[24px]", isStable ? "bg-info/70" : "bg-warning/60")}
                  style={{ height: `${fillPct}%` }}
                />
                <div className="absolute inset-x-2 bottom-2.5 flex flex-col items-center gap-0.5 text-center">
                  <p>
                    <span className={cn("text-xl font-bold", isStable ? "text-info" : "text-warning")}>{tank.strawInStock}</span>
                    <span className="text-xs text-muted-foreground">/{tank.strawCapacity}</span>
                  </p>
                  <span className="text-xs text-muted-foreground">{t("strawInStock")}</span>
                </div>
              </div>
            </div>
            <div className="flex flex-1 flex-col gap-6 rounded-xl bg-muted p-4">
              <p className="text-xl font-bold text-foreground">{tank.name}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-5">
                <InfoField label={t("modelManufacturer")} value={tank.modelManufacturer ?? "—"} />
                <InfoField label={t("strawCapacity")} value={`${tank.strawCapacity}`} />
                <InfoField label={t("numCanisters")} value={tank.numCanisters != null ? `${tank.numCanisters}` : "—"} />
                <InfoField label={t("numGoblets")} value={tank.numGoblets != null ? `${tank.numGoblets}` : "—"} />
                <InfoField label={t("storageLocation")} value={tank.storageLocation ?? "—"} />
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="border-t border-dashed border-border" />
          <div className="flex gap-2 pt-5">
            <Button type="button" variant="secondary" className="h-[52px] flex-1 rounded-xl" onClick={() => onOpenChange(false)}>
              {t("close")}
            </Button>
          </div>
        </div>
      </div>
    </SheetContent>
  );
}
