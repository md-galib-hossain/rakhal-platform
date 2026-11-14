-- RAKHAL-444: a FeedItemBatch lot has no meaning without its FeedItem product; cascade a hard delete.
-- (Production only archives via deletedAt; this keeps test/cleanup hard-deletes from being FK-blocked.)
ALTER TABLE "FeedItemBatch" DROP CONSTRAINT "FeedItemBatch_feedItemId_fkey";
ALTER TABLE "FeedItemBatch" ADD CONSTRAINT "FeedItemBatch_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "Forage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
