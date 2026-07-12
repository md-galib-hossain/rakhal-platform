"use client";

import { useTranslations } from "next-intl";
import { CircleDollarSign, Package, PillBottle } from "lucide-react";
import { cn } from "@/lib/utils";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { avatarTint } from "../avatar-tint";
import { MedicineRowActions } from "./medicine-row-actions";
import type { Medicine } from "../types";

const STOCK_COLOR: Record<Medicine["stockStatus"], string> = {
  adequate: "text-success",
  low: "text-warning",
  out: "text-destructive",
};

function MedicineCard({
  medicine,
  onEdit,
  onArchive,
}: {
  medicine: Medicine;
  onEdit: (medicine: Medicine) => void;
  onArchive: (medicine: Medicine) => void;
}) {
  const t = useTranslations("inventory.medicine");
  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="relative h-[170px] w-full shrink-0">
        {medicine.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed/arbitrary host thumbnail, same tradeoff as CattleThumbnail
          <img src={medicine.imageUrl} alt="" className="size-full object-cover" />
        ) : (
          <div className={cn("flex size-full items-center justify-center", avatarTint(medicine.id))}>
            <PillBottle className="size-10" aria-hidden />
          </div>
        )}
        {medicine.batchId ? (
          <span className="absolute left-3 top-3 rounded-full bg-info px-3 py-1 text-xs font-bold text-white shadow-sm">
            {medicine.batchId}
          </span>
        ) : null}
        <span className="absolute left-3 top-11 flex gap-1.5">
          <span className="rounded-full bg-card/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
            {t(`typeOptions.${medicine.type}`)}
          </span>
          <span className="rounded-full bg-card/95 px-2.5 py-1 text-xs font-medium text-foreground shadow-sm">
            {t(`categoryOptions.${medicine.category}`)}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between">
          <p className="text-base font-bold text-foreground">{medicine.name}</p>
          <MedicineRowActions medicine={medicine} onEdit={onEdit} onArchive={onArchive} />
        </div>

        <div className="flex flex-col gap-2 text-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <CircleDollarSign className="size-4" aria-hidden />
              {t("columns.costPerUnit")}
            </span>
            <MoneyText amount={medicine.costPerUnit} className="font-medium text-foreground" />
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t("columns.purchaseDate")}</span>
            <span className="font-medium text-foreground">
              <DateText date={medicine.purchaseDate} />
            </span>
          </div>
          <div className="flex items-center justify-between text-muted-foreground">
            <span>{t("columns.expiryDate")}</span>
            <span className="font-medium text-foreground">
              <DateText date={medicine.expiryDate} />
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border pt-3">
          <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
            <Package className="size-4" aria-hidden />
            {t("columns.stock")}
          </span>
          <span className="flex items-baseline gap-1">
            <span className={cn("text-2xl font-bold", STOCK_COLOR[medicine.stockStatus])}>{medicine.currentStock}</span>
            <span className="text-xs text-muted-foreground">{medicine.unit}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Card grid view (Figma "Inventory - Medicine - Grid View" frame 732:11796) — same data/actions
 * as `MedicineTable`, toggled via `InventoryTabs`' view switch, not a separate query. */
export function MedicineGrid({
  items,
  isLoading,
  isError,
  onRetry,
  onEdit,
  onArchive,
}: {
  items: Medicine[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: (medicine: Medicine) => void;
  onArchive: (medicine: Medicine) => void;
}) {
  const t = useTranslations("inventory.medicine");

  if (isError) return <ErrorState onRetry={onRetry} />;
  if (!isLoading && items.length === 0) {
    return <EmptyState title={t("empty.title")} description={t("empty.description")} />;
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {isLoading && items.length === 0
        ? Array.from({ length: 8 }, (_, i) => (
            <div key={i} className="h-[380px] animate-pulse rounded-2xl border border-border bg-muted" />
          ))
        : items.map((medicine) => (
            <MedicineCard key={medicine.id} medicine={medicine} onEdit={onEdit} onArchive={onArchive} />
          ))}
    </div>
  );
}
