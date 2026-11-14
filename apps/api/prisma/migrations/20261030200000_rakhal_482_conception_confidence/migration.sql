-- CreateEnum
CREATE TYPE "ConceptionConfidence" AS ENUM ('RECORDED', 'ESTIMATED', 'UNKNOWN');

-- AlterTable
ALTER TABLE "Pregnancy" ADD COLUMN     "conceptionConfidence" "ConceptionConfidence" NOT NULL DEFAULT 'RECORDED',
ALTER COLUMN "conceptionDate" DROP NOT NULL;


-- Pregnancies with no linked breeding had their conception date estimated (check date, gestation day or expected calving).
UPDATE "Pregnancy" SET "conceptionConfidence" = 'ESTIMATED' WHERE "breedingEventId" IS NULL;
