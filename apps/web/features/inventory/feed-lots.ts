import type { FeedItem, FeedItemBatch } from "./types";

/** The lot the next feeding will draw from: batches arrive oldest-purchase-first (FIFO), so it is the
 * first one that still has stock (ADR-026 D6). `undefined` when the shelf is empty. */
export function nextFeedLot(item: Pick<FeedItem, "batches">): FeedItemBatch | undefined {
  return item.batches.find((batch) => batch.currentStock > 0);
}

/** Live lots that still hold stock — a feeding can span more than one when the next lot runs out. */
export function stockedLotCount(item: Pick<FeedItem, "batches">): number {
  return item.batches.filter((batch) => batch.currentStock > 0).length;
}
