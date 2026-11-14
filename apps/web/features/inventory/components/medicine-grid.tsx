"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, CalendarX, Coins, Package, PillBottle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@rakhal/ui/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@rakhal/ui/shared/error-state";
import { SelectableCardOverlay } from "@/components/shared/selectable-card-overlay";
import { avatarTint } from "../avatar-tint";
import { MedicineRowActions } from "./medicine-row-actions";
import type { Medicine } from "../types";
import { TruncatedText } from "@rakhal/ui/shared/truncated-text";

const STOCK_COLOR: Record<Medicine["stockStatus"], string> = {
  adequate: "text-success",
  low: "text-warning",
  out: "text-destructive",
};

/** Card matched to the Figma "Inventory Item Card" component (732:17670, `get_design_context`):
 * 8px outer padding, `shadow-card` (no border), a 160px image inset 10px with its own 12px
 * radius, batch/type/category chips stacked top-left over the image, name, 3 icon+label/value
 * rows (values share the label's muted color, not bold foreground), and the Stock row as its own
 * nested `shadow-card` pill — not just a top divider. The Figma mock has no row-action affordance
 * at all; a small overlay "…" button was added (top-right of the image) since edit/archive still
 * need a real entry point from grid view. */
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
    <div className="flex w-full flex-col items-center gap-2.5 rounded-2xl bg-card p-2 shadow-card">
      <div className="relative h-[160px] w-full shrink-0 overflow-hidden rounded-xl">
        {medicine.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- signed/arbitrary host thumbnail, same tradeoff as CattleThumbnail
          <img src={medicine.imageUrl} alt="" loading="lazy" decoding="async" className="size-full object-cover" />
        ) : (
          <div className={cn("flex size-full items-center justify-center", avatarTint(medicine.id))}>
            <PillBottle className="size-10" aria-hidden />
          </div>
        )}

        <div className="absolute right-2 top-2">
          <MedicineRowActions
            medicine={medicine}
            onEdit={onEdit}
            onArchive={onArchive}
            triggerClassName="size-7 rounded-full bg-card/90 text-foreground shadow-sm hover:bg-card"
          />
        </div>

        <div className="absolute left-2.5 top-2.5 flex flex-col items-start gap-1.5">
          {medicine.batchId ? <Chip variant="info">{medicine.batchId}</Chip> : null}
          <div className="flex items-center gap-1.5">
            <Chip variant="muted">{t(`typeOptions.${medicine.type}`)}</Chip>
            <Chip variant="muted">{t(`categoryOptions.${medicine.category}`)}</Chip>
          </div>
        </div>
      </div>

      <div className="flex w-full flex-col gap-6 px-1.5 pb-1.5">
        <TruncatedText className="text-xl font-bold text-foreground">{medicine.name}</TruncatedText>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Coins className="size-4" aria-hidden />
              {t("columns.costPerUnit")}
            </span>
            <MoneyText amount={medicine.costPerUnit} className="text-sm font-medium text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden />
              {t("columns.purchaseDate")}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              <DateText date={medicine.purchaseDate} />
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarX className="size-4" aria-hidden />
              {t("columns.expiryDate")}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              <DateText date={medicine.expiryDate} />
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-card p-2 shadow-card">
          <span className="flex items-center gap-1 text-base font-medium text-muted-foreground">
            <Package className="size-[18px]" aria-hidden />
            {t("columns.stock")}
          </span>
          <span className="flex items-baseline gap-1">
            <span className={cn("text-[28px] font-bold leading-none", STOCK_COLOR[medicine.stockStatus])}>{medicine.currentStock}</span>
            <span className="text-sm font-medium text-muted-foreground">{medicine.unit.symbol}</span>
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
  canSelect,
  isSelected,
  onToggleSelect,
}: {
  items: Medicine[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onEdit: (medicine: Medicine) => void;
  onArchive: (medicine: Medicine) => void;
  canSelect: boolean;
  isSelected: (id: string) => boolean;
  onToggleSelect: (id: string) => void;
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
            <div key={i} className="h-[400px] animate-pulse rounded-2xl bg-muted" />
          ))
        : items.map((medicine) => (
            <SelectableCardOverlay
              key={medicine.id}
              canSelect={canSelect}
              selected={isSelected(medicine.id)}
              onToggleSelect={() => onToggleSelect(medicine.id)}
              label={t("bulk.selectCard", { name: medicine.name })}
            >
              <MedicineCard medicine={medicine} onEdit={onEdit} onArchive={onArchive} />
            </SelectableCardOverlay>
          ))}
    </div>
  );
}
