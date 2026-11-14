-- Invites move to email delivery (no SMS provider is wired). `phone` becomes
-- optional; `email` becomes the delivery + redeemer-binding channel.
--
-- Backfill: existing PENDING/EXPIRED rows were created before this migration
-- and were never actually delivered (SMS was always stubbed) — they are
-- backfilled with the inviter's own email as a non-null placeholder so the
-- column can be NOT NULL. This does not make a previously-undeliverable
-- invite deliverable; it just satisfies the constraint for old rows, which
-- will continue to expire on their existing `expiresAt` as before.
ALTER TABLE "FarmInvitation" ADD COLUMN "email" TEXT;

UPDATE "FarmInvitation" fi
SET "email" = u."email"
FROM "User" u
WHERE u."id" = fi."invitedById" AND fi."email" IS NULL;

ALTER TABLE "FarmInvitation" ALTER COLUMN "email" SET NOT NULL;
ALTER TABLE "FarmInvitation" ALTER COLUMN "phone" DROP NOT NULL;
