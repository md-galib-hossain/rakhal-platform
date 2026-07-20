"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, Coins, Package, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { avatarTint } from "../avatar-tint";
import { EquipmentRowActions } from "./equipment-row-actions";
import type { Equipment } from "../types";

const STOCK_COLOR: Record<Equipment["stockStatus"], string> = {
  adequate: "text-success",
  low: "text-warning",
  out: "text-destructive",
};

/** Card matched to the same Figma "Inventory Item Card" component Medicine/FeedItem use — 8px outer
 * padding, `shadow-card`, a 160px image inset with its own radius, type chip stacked top-left, name,
 * icon+label/value rows, Stock as its own nested `shadow-card` pill. Equipment has no `imageUrl`
 * (see `types.ts#Equipment` doc comment) so the image slot always shows the tinted `Wrench` fallback,
 * never a real photo, and there's no batch/expiry chip since neither field exists on the backend. */
function EquipmentCard({
  equipment,
  onEdit,
  onArchive,
}: {
  equipment: Equipment;
  onEdit: (equipment: Equipment) => void;
  onArchive: (equipment: Equipment) => void;
}) {
  const t = useTranslations("inventory.equipment");
  return (
    <div className="flex w-full flex-col items-center gap-2.5 rounded-2xl bg-card p-2 shadow-card">
      <div className="relative h-[160px] w-full shrink-0 overflow-hidden rounded-xl">
        <div className={cn("flex size-full items-center justify-center", avatarTint(equipment.id))}>
          <Wrench className="size-10" aria-hidden />
        </div>

        <div className="absolute right-2 top-2">
          <EquipmentRowActions
            equipment={equipment}
            onEdit={onEdit}
            onArchive={onArchive}
            triggerClassName="size-7 rounded-full bg-card/90 text-foreground shadow-sm hover:bg-card"
          />
        </div>

        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <Chip variant="muted">{t(`typeOptions.${equipment.type}`)}</Chip>
          {equipment.assetId ? <Chip variant="info">{equipment.assetId}</Chip> : null}
        </div>
      </div>

      <div className="flex w-full flex-col gap-6 px-1.5 pb-1.5">
        <p className="truncate text-xl font-bold text-foreground">{equipment.name}</p>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Coins className="size-4" aria-hidden />
              {t("columns.costPerUnit")}
            </span>
            <MoneyText amount={equipment.costPerUnit} className="text-sm font-medium text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden />
              {t("columns.purchaseDate")}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              <DateText date={equipment.purchaseDate} />
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-card p-2 shadow-card">
          <span className="flex items-center gap-1 text-base font-medium text-muted-foreground">
            <Package className="size-[18px]" aria-hidden />
            {t("columns.stock")}
          </span>
          <span className="flex items-baseline gap-1">
            <span className={cn("text-[28px] font-bold leading-none", STOCK_COLOR[equipment.stockStatus])}>{equipment.currentStock}</span>
            <span className="text-sm font-medium text-muted-foreground">{equipment.unit || t("piece")}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Card grid view — same data/actions as `EquipmentTable`, toggled via `InventoryTabs`' view switch. */
export function EquipmentGrid({
  items,
  isLoading,
  isError,
  onRetry,
  onEdit,
  onArchive,
}: {
  items: Equipment[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: (equipment: Equipment) => void;
  onArchive: (equipment: Equipment) => void;
}) {
  const t = useTranslations("inventory.equipment");

  if (isError) return <ErrorState onRetry={onRetry} />;
  if (!isLoading && items.length === 0) {
    return <EmptyState title={t("empty.title")} description={t("empty.description")} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {isLoading && items.length === 0
        ? Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-[400px] animate-pulse rounded-2xl bg-muted" />
          ))
        : items.map((equipment) => (
            <EquipmentCard key={equipment.id} equipment={equipment} onEdit={onEdit} onArchive={onArchive} />
          ))}
    </div>
  );
}
