-- Additive column, hand-authored: `prisma migrate dev`'s shadow-DB diff refuses to run because an
-- earlier migration's checksum drifted (edited after being applied, unrelated to this change) and
-- demands a full `migrate reset` of the shared dev DB. Applying directly + `migrate resolve` instead.
ALTER TABLE "MilkTank" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT false;
