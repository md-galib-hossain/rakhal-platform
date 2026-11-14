-- RAKHAL-446: stock movements are history of one feed item's lots; cascade a hard delete (same rationale
-- as the FeedItemBatch cascade in 20260923140000 — production only archives via deletedAt, this keeps
-- test/cleanup hard-deletes from being FK-blocked now that feedings write movements).
ALTER TABLE "FeedItemStockMovement" DROP CONSTRAINT "FeedItemStockMovement_feedItemId_fkey";
ALTER TABLE "FeedItemStockMovement" ADD CONSTRAINT "FeedItemStockMovement_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "Forage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
