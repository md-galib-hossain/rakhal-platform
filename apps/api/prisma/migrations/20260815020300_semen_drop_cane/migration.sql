-- Semen tank/batch only track Canister (not Cane) per product decision.
ALTER TABLE "SemenTank" DROP COLUMN "numCanes";
ALTER TABLE "SemenBatch" DROP COLUMN "cane";
