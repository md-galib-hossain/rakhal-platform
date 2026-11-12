"use client"; // react-query subscriptions for per-source stock

import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { qk } from "@/lib/query/keys";
import { inventoryApi } from "@/features/inventory/api";
import { useConcentrations, useFeedStock } from "../../feed/hooks/use-feed";
import { sourceKey, type RowSource, type StockInfo } from "../grid-model";

/**
 * Name + kg on hand for every source the grid's rows use (bought feed items and prepared batches), keyed by
 * `sourceKey`. Bought items are fetched by id (cached, shared with the inventory screens) so a row can show and cap
 * against stock without the grid loading the whole inventory. A feed item counted in a non-weight unit with no
 * kg-per-unit gets `availableKg: null` (uncapped here; the server still validates on confirm).
 */
export function useSourceStock(sources: RowSource[], unknownBatchLabel: string): Map<string, StockInfo> {
  const stock = useFeedStock();
  const concentrations = useConcentrations();

  const itemKey = [...new Set(sources.filter((s) => s.sourceType === "FEED_ITEM").map((s) => s.itemId))].sort().join(",");
  const itemIds = useMemo(() => (itemKey ? itemKey.split(",") : []), [itemKey]);

  const itemQueries = useQueries({
    queries: itemIds.map((id) => ({
      queryKey: qk.inventory.feedItemDetail(id),
      queryFn: () => inventoryApi.findFeedItem(id),
      staleTime: 30_000,
    })),
  });
  // `useQueries` returns a fresh array every render — key the memo on the data's own update stamps instead.
  const itemStamp = itemQueries.map((q) => q.dataUpdatedAt).join(",");

  return useMemo(() => {
    const map = new Map<string, StockInfo>();
    itemIds.forEach((id, i) => {
      const item = itemQueries[i]?.data;
      if (!item) return;
      const availableKg = item.unit.symbol === "kg" ? item.currentStock : item.kgEquivalent;
      const n = item.nutrition;
      map.set(sourceKey({ sourceType: "FEED_ITEM", itemId: id }), {
        label: item.name,
        availableKg,
        density: n ? { dm_pct: n.dmPct, cp_pct: n.cpPct, me_mj_per_kg_dm: n.meMjPerKgDm } : null,
      });
    });
    for (const lot of stock.data ?? []) {
      const name = concentrations.data?.find((c) => c.id === lot.source_concentration_id)?.name ?? unknownBatchLabel;
      map.set(sourceKey({ sourceType: "FEED_STOCK", itemId: lot.id }), { label: name, availableKg: lot.current_stock_kg });
    }
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemIds, itemStamp, stock.data, concentrations.data, unknownBatchLabel]);
}
