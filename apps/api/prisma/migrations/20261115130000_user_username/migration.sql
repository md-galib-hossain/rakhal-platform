-- WP5b (mobile): optional login handle. Additive and nullable: no backfill, existing email users unaffected.
-- Stored lowercase (CHECK is defence in depth; the service normalises), globally unique.
ALTER TABLE "User" ADD COLUMN "username" TEXT;

CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

ALTER TABLE "User" ADD CONSTRAINT "User_username_lowercase_chk" CHECK ("username" IS NULL OR "username" = lower("username"));
