-- AlterTable
ALTER TABLE "Farm" ADD COLUMN     "cattleIdPrefix" TEXT,
ADD COLUMN     "farmCode" TEXT,
ADD COLUMN     "herdSizeBand" TEXT;

-- CreateTable
CREATE TABLE "FarmCounter" (
    "scope" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FarmCounter_pkey" PRIMARY KEY ("scope")
);

-- CreateIndex
CREATE UNIQUE INDEX "Farm_farmCode_key" ON "Farm"("farmCode");
