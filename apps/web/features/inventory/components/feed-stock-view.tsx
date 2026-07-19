"use client"; // live query, joins stock lots against the cached concentrations list for a display name

import { useMemo } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Package } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Locale } from "@/lib/constants/i18n";
import { CardSkeleton } from "@/components/shared/card-skeleton";
import { ErrorState } from "@/components/shared/error-state";
import { EmptyState } from "@/components/shared/empty-state";
import { MoneyText } from "@/components/shared/money-text";
import { useConcentrations, useFeedStock } from "@/features/feed/hooks/use-feed";

/**
 * Inventory's "Feed" tab (moved here 2026-07-19 from a standalone section on the Feed Formulator
 * page — user report: "we have already a inventory... no need to create the tmr feed inventory
 * here"). Read-only list of `FeedStock` lots produced by finalizing a Concentrate Mixer or TMR on
 * the Feed Formulator page; actual stock *decrement* happens through "Feed Today"
 * (`features/feed/components/log-distribution-dialog.tsx`), not here. Cross-imports the Feed
 * module's own hooks/model rather than duplicating them under `features/inventory` — `FeedStock` is
 * owned by `src/modules/feed/` on the backend, not `src/modules/inventory/` (see `types.ts`'s doc
 * comment on `InventoryTabKey`). Joins each lot's `source_concentration_id` against the already
 * -cached `useConcentrations()` list for a human name rather than adding a backend join.
 */
export function FeedStockView() {
  const t = useTranslations("feed.stock");
  const locale = useLocale() as Locale;
  const stock = useFeedStock();
  const concentrations = useConcentrations();

  const nameById = useMemo(
    () => new Map((concentrations.data ?? []).map((c) => [c.id, c.name])),
    [concentrations.data],
  );

  if (stock.isLoading) return <CardSkeleton lines={3} />;
  if (stock.isError) return <ErrorState onRetry={() => stock.refetch()} />;
  if ((stock.data ?? []).length === 0) return <EmptyState icon={Package} title={t("empty")} />;

  return (
    <div className="flex flex-col divide-y divide-border rounded-2xl border border-border bg-card px-4">
      {(stock.data ?? []).map((lot) => (
        <div key={lot.id} className="flex items-center justify-between gap-4 py-3">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-bold text-foreground">
              {nameById.get(lot.source_concentration_id) ?? t("unknownSource")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("producedOn")} {formatDate(lot.produced_at, locale)}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-5 text-right">
            <div>
              <p className="text-xs text-muted-foreground">{t("producedQty")}</p>
              <p className="text-sm font-medium text-foreground">{lot.produced_qty_kg} kg</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("remaining")}</p>
              <p className={lot.current_stock_kg > 0 ? "text-sm font-bold text-success" : "text-sm font-bold text-muted-foreground"}>
                {lot.current_stock_kg} kg
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{t("cost")}</p>
              <p className="text-sm font-medium text-foreground">
                <MoneyText amount={lot.produced_cost_tk} />
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
