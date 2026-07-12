"use client";

import { useTranslations } from "next-intl";
import { CalendarDays, Coins, Package, Wheat } from "lucide-react";
import { cn } from "@/lib/utils";
import { Chip } from "@/components/ui/chip";
import { DateText } from "@/components/shared/date-text";
import { MoneyText } from "@/components/shared/money-text";
import { EmptyState } from "@/components/shared/empty-state";
import { ErrorState } from "@/components/shared/error-state";
import { avatarTint } from "../avatar-tint";
import { ForageRowActions } from "./forage-row-actions";
import type { Forage } from "../types";

const STOCK_COLOR: Record<Forage["stockStatus"], string> = {
  adequate: "text-success",
  low: "text-warning",
  out: "text-destructive",
};

/** Card matched to the Figma "Inventory Item Card" component (732:18604, `get_design_context`) as
 * reused on the Forage grid frame (732:13093): same anatomy as `MedicineCard` minus the batch chip
 * (no `batchId` field on `Forage`) and the expiry-date row (no `expiryDate` field either) — 2 rows
 * only (Cost Per Unit, Purchase Date). Forage has no photo field at all, so the image slot is
 * always the tinted `Wheat` fallback, never a real thumbnail. */
function ForageCard({
  forage,
  onView,
  onEdit,
  onArchive,
}: {
  forage: Forage;
  onView: (forage: Forage) => void;
  onEdit: (forage: Forage) => void;
  onArchive: (forage: Forage) => void;
}) {
  const t = useTranslations("inventory.forage");
  return (
    <div className="flex w-full flex-col items-center gap-2.5 rounded-2xl bg-card p-2 shadow-card">
      <div className="relative h-[160px] w-full shrink-0 rounded-xl">
        {/* Plain `<button>`, not a `role="button"` div, so the overlapping `ForageRowActions`
            trigger (a sibling rendered after it, positioned on top via z-index) naturally receives
            its own clicks without needing `stopPropagation` on a nested interactive element. */}
        <button
          type="button"
          onClick={() => onView(forage)}
          className="absolute inset-0 cursor-pointer overflow-hidden rounded-xl text-left"
        >
          <div className={cn("flex size-full items-center justify-center", avatarTint(forage.id))}>
            <Wheat className="size-10" aria-hidden />
          </div>
        </button>

        <div className="absolute right-2 top-2 z-10">
          <ForageRowActions
            forage={forage}
            onView={onView}
            onEdit={onEdit}
            onArchive={onArchive}
            triggerClassName="size-7 rounded-full bg-card/90 text-foreground shadow-sm hover:bg-card"
          />
        </div>

        <div className="pointer-events-none absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <Chip variant="muted">{t(`typeOptions.${forage.type}`)}</Chip>
          {forage.category ? <Chip variant="muted">{forage.category}</Chip> : null}
        </div>
      </div>

      <div className="flex w-full flex-col gap-6 px-1.5 pb-1.5">
        <p className="truncate text-xl font-bold text-foreground">{forage.name}</p>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <Coins className="size-4" aria-hidden />
              {t("columns.costPerUnit")}
            </span>
            <MoneyText amount={forage.costPerUnit} className="text-sm font-medium text-muted-foreground" />
          </div>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <CalendarDays className="size-4" aria-hidden />
              {t("columns.purchaseDate")}
            </span>
            <span className="text-sm font-medium text-muted-foreground">
              <DateText date={forage.purchaseDate} />
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between rounded-xl bg-card p-2 shadow-card">
          <span className="flex items-center gap-1 text-base font-medium text-muted-foreground">
            <Package className="size-[18px]" aria-hidden />
            {t("columns.stock")}
          </span>
          <span className="flex items-baseline gap-1">
            <span className={cn("text-[28px] font-bold leading-none", STOCK_COLOR[forage.stockStatus])}>{forage.currentStock}</span>
            <span className="text-sm font-medium text-muted-foreground">{forage.unit}</span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Card grid view (Figma "Inventory - Forage" grid frame 732:13093) — same data/actions as
 * `ForageTable`, toggled via `InventoryTabs`' view switch, not a separate query. */
export function ForageGrid({
  items,
  isLoading,
  isError,
  onRetry,
  onView,
  onEdit,
  onArchive,
}: {
  items: Forage[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  onView: (forage: Forage) => void;
  onEdit: (forage: Forage) => void;
  onArchive: (forage: Forage) => void;
}) {
  const t = useTranslations("inventory.forage");

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
        : items.map((forage) => (
            <ForageCard key={forage.id} forage={forage} onView={onView} onEdit={onEdit} onArchive={onArchive} />
          ))}
    </div>
  );
}
