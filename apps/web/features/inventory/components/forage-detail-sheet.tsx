"use client"; // live query + sheet open state

import { useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRightToLine, CalendarDays, Coins, Droplet, Package, Wheat } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { StatCard } from "@/components/shared/stat-card";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { cn } from "@/lib/utils";
import { avatarTint } from "../avatar-tint";
import { useForageDetail } from "../hooks/use-inventory";
import { ForageStockUpdateDialog } from "./forage-stock-update-dialog";
import type { Forage } from "../types";

const STOCK_CHIP_VARIANT: Record<Forage["stockStatus"], "primary" | "warning" | "destructive"> = {
  adequate: "primary",
  low: "warning",
  out: "destructive",
};

/**
 * "Item Details - Forage" right-side drawer — Figma frame 732:13304, same floating-card chrome as
 * `ForageFormDialog`/`CattleDetailSheet` (680px max width here, matching the Figma frame's own
 * 640px content + 20px padding on each side — not Cattle's 820px, a different-sized design).
 * Forage has no photo field (see `types.ts#Forage` doc comment) so the image slot is always the
 * tinted `Wheat` fallback. The mock's "Local Market" subtitle has no matching field name — mapped
 * to the real `supplier` string, the closest real equivalent, not fabricated. The mock's cyan
 * "Moisture" tile color has no matching token in this app's palette — reuses the existing
 * `accent-teal` token (closest neighbor) rather than inventing a new one.
 */
export function ForageDetailSheet({
  forageId,
  onOpenChange,
  onEdit,
}: {
  forageId: string | undefined;
  onOpenChange: (open: boolean) => void;
  onEdit: (forage: Forage) => void;
}) {
  const t = useTranslations("inventory.forage.detail");
  const tOptions = useTranslations("inventory.forage");
  const query = useForageDetail(forageId);
  const [stockUpdateOpen, setStockUpdateOpen] = useState(false);

  return (
    <>
      <Sheet open={Boolean(forageId)} onOpenChange={onOpenChange}>
        <SheetContent
          showClose={false}
          className="inset-y-2.5 right-2.5 flex h-[calc(100vh-20px)] w-[calc(100%-20px)] max-w-[680px] flex-col gap-0 rounded-[20px] border-2 border-border p-5 shadow-2xl sm:max-w-[680px]"
        >
          <div className="flex items-center justify-between pb-5">
            <SheetTitle className="text-xl font-bold text-foreground">{t("title")}</SheetTitle>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              aria-label={t("close")}
              className="flex size-5 items-center justify-center text-foreground transition-opacity hover:opacity-70"
            >
              <ArrowRightToLine className="size-5" aria-hidden />
            </button>
          </div>
          <div className="border-t border-dashed border-border" />

          <div className="flex-1 overflow-y-auto py-4">
            {query.isLoading ? (
              <CardSkeleton lines={3} />
            ) : query.isError || !query.data ? (
              <ErrorState description={t("error")} onRetry={() => query.refetch()} />
            ) : (
              <div className="flex flex-col gap-6">
                <div className="flex items-start gap-4">
                  <div className={cn("flex size-[140px] shrink-0 items-center justify-center rounded-2xl", avatarTint(query.data.id))}>
                    <Wheat className="size-10" aria-hidden />
                  </div>
                  <div className="flex flex-col gap-3 py-1">
                    <div className="flex flex-col gap-1.5">
                      <p className="text-2xl font-bold text-foreground">{query.data.name}</p>
                      {query.data.supplier ? <p className="text-sm text-muted-foreground">{query.data.supplier}</p> : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip variant="muted">{tOptions(`typeOptions.${query.data.type}`)}</Chip>
                      {query.data.category ? <Chip variant="muted">{query.data.category}</Chip> : null}
                    </div>
                    <Chip variant={STOCK_CHIP_VARIANT[query.data.stockStatus]}>{t(`stockStatus.${query.data.stockStatus}`)}</Chip>
                  </div>
                </div>

                <div className="border-t border-dashed border-border" />

                <div className="flex flex-col gap-4">
                  <p className="text-lg font-bold text-foreground">{t("itemStatistics")}</p>
                  <div className="grid grid-cols-2 gap-4">
                    <StatCard
                      label={t("costPerUnit")}
                      value={<MoneyText amount={query.data.costPerUnit} />}
                      icon={<Coins className="size-4" aria-hidden />}
                      iconClassName="bg-success-tint text-success"
                    />
                    <StatCard
                      label={t("currentStock")}
                      value={`${query.data.currentStock} ${query.data.unit}`}
                      icon={<Package className="size-4" aria-hidden />}
                      iconClassName="bg-info-tint text-info"
                    />
                    <StatCard
                      label={t("purchaseDate")}
                      value={<DateText date={query.data.purchaseDate} />}
                      icon={<CalendarDays className="size-4" aria-hidden />}
                      iconClassName="bg-accent-purple-tint text-accent-purple"
                    />
                    <StatCard
                      label={t("moisture")}
                      value={query.data.moisturePct != null ? `${query.data.moisturePct}%` : "—"}
                      icon={<Droplet className="size-4" aria-hidden />}
                      iconClassName="bg-accent-teal-tint text-accent-teal"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-4">
                  <p className="text-lg font-bold text-foreground">{t("note")}</p>
                  <div className="rounded-xl border border-border p-4">
                    <p className="text-sm text-foreground">{query.data.notes || t("noNotes")}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-dashed border-border" />
          <div className="flex gap-3 pt-5">
            <Button
              type="button"
              variant="secondary"
              className="h-12 flex-1"
              disabled={!query.data}
              onClick={() => query.data && onEdit(query.data)}
            >
              {t("editItem")}
            </Button>
            <Button type="button" className="h-12 flex-1" disabled={!query.data} onClick={() => setStockUpdateOpen(true)}>
              {t("stockUpdate")}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <ForageStockUpdateDialog forage={query.data ?? null} open={stockUpdateOpen} onOpenChange={setStockUpdateOpen} />
    </>
  );
}
