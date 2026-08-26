-- RAKHAL-364 — Promote Sale/Receivable customer to a real MilkBuyer FK
-- (MILESTONE 22, `docs/BUSINESS_IA_PRD.md` §7). Hand-authored (same
-- precedent as every prior migration on this board — `prisma migrate dev`/
-- `diff` both refuse non-interactively in this environment).
--
-- `prisma migrate diff --from-config-datasource --to-schema prisma --script`
-- output was clean except two pieces of unrelated, already-documented
-- pre-existing drift, both excluded here per the same precedent every prior
-- hand-authored migration on this board follows:
--   1. `SafetyWithdrawalStatus` enum-value-order rename (RD-054).
--   2. `IncomeCategory_farmId_fkey` FK-action drop+recreate (unrelated to
--      this ticket's schema edits, not touched by this diff's own changes).
--
-- Live dev-DB check before writing this file: 375 `Sale` rows, 38 with a
-- non-null `customerId`, of which **24 do not resolve to a `MilkBuyer` row
-- in the same farm** — confirmed as literal free-text strings ("Rahim
-- Traders" x18, "RAKHAL-352 E2E buyer" x6), exactly the "free-form
-- reference" the pre-364 column doc comment described. `Receivable` has 221
-- rows and **zero** ever had `customerId` set (RD-062, now closed by step 2
-- below). Steps run in order: null the unresolvable `Sale.customerId`
-- values first, backfill `Receivable.customerId` from `Sale` second (so it
-- inherits the already-cleaned value, never a stale orphan), *then*
-- constrain both. Constraining before cleaning would fail the migration
-- outright against this exact data.

-- Step 1: null out Sale.customerId values that don't resolve to a MilkBuyer
-- in the same farm (dev/seed data only, per ADR-022's "drop and rebuild"
-- precedent for legacy finance data — this backfill is the customerId-only
-- equivalent, not a full ledger drop).
UPDATE "Sale" s SET "customerId" = NULL
 WHERE s."customerId" IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM "MilkBuyer" b
      WHERE b.id = s."customerId" AND b."farmId" = s."farmId"
   );

-- Step 2: backfill Receivable.customerId from its Sale — closes RD-062
-- (`Receivable.customerId` was never persisted; every existing row is
-- NULL today).
UPDATE "Receivable" r SET "customerId" = s."customerId"
  FROM "Sale" s
 WHERE r."saleId" = s.id;

-- AlterTable — MilkBuyer.basePricePerLitre gains a default so a non-milk
-- buyer (animal trader, manure buyer) can be created as the generic
-- Sale/Receivable customer FK target without inventing a milk price
-- (RD-067).
ALTER TABLE "MilkBuyer" ALTER COLUMN "basePricePerLitre" SET DEFAULT 0;

-- AddForeignKey — Sale.customerId -> MilkBuyer.id. onDelete: Restrict
-- (buyers archive via isActive, never hard-delete).
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "MilkBuyer"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey — Receivable.customerId -> MilkBuyer.id. Same onDelete
-- policy as Sale.customerId above.
ALTER TABLE "Receivable" ADD CONSTRAINT "Receivable_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "MilkBuyer"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
