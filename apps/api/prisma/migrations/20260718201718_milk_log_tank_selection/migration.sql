-- AlterTable
ALTER TABLE "MilkLogEntry" ADD COLUMN     "tankId" TEXT;

-- CreateIndex
CREATE INDEX "MilkLogEntry_tankId_idx" ON "MilkLogEntry"("tankId");

-- AddForeignKey
ALTER TABLE "MilkLogEntry" ADD CONSTRAINT "MilkLogEntry_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "MilkTank"("id") ON DELETE SET NULL ON UPDATE CASCADE;
