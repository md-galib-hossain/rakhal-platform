/** Derived metrics shared by `feed-stock-columns.tsx` (table) and `feed-stock-grid.tsx` (card view)
 * — kept as one pure module so the two views can never compute a number differently. `FeedStock`
 * itself only carries `produced_qty_kg`/`current_stock_kg`/`produced_cost_tk`; per-kg cost,
 * consumed quantity, and a remaining-stock status are all derived client-side, same pattern as
 * `domain/medicine-status.ts` deriving `stockStatus` from raw stock/threshold fields. */

export type RemainingStockStatus = "out" | "low" | "adequate";

export const REMAINING_STOCK_COLOR: Record<RemainingStockStatus, string> = {
  adequate: "text-success",
  low: "text-warning",
  out: "text-destructive",
};

/** `null` when `producedQtyKg` is 0 — a batch can't have a meaningful per-kg cost with no output. */
export function costPerKg(producedCostTk: number, producedQtyKg: number): number | null {
  if (producedQtyKg <= 0) return null;
  return producedCostTk / producedQtyKg;
}

export function consumedKg(currentStockKg: number, producedQtyKg: number): number {
  return Math.max(0, producedQtyKg - currentStockKg);
}

/** % of the produced batch still in stock, 0-100. */
export function remainingPct(currentStockKg: number, producedQtyKg: number): number {
  if (producedQtyKg <= 0) return 0;
  return Math.max(0, Math.min(100, (currentStockKg / producedQtyKg) * 100));
}

/** Thresholds mirror the Purchased tab's `stockStatus` convention (out ≤ 0, low ≤ 20% of the
 * original batch, else adequate) so the two segments read the same "traffic light" language. */
export function remainingStatus(currentStockKg: number, producedQtyKg: number): RemainingStockStatus {
  if (currentStockKg <= 0) return "out";
  if (remainingPct(currentStockKg, producedQtyKg) <= 20) return "low";
  return "adequate";
}
