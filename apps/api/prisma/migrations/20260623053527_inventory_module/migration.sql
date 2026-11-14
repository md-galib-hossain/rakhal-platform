-- CreateEnum
CREATE TYPE "MedicineType" AS ENUM ('LIQUID', 'POWDER', 'TABLET', 'INJECTABLE', 'BOLUS', 'OINTMENT', 'OTHER');

-- CreateEnum
CREATE TYPE "MedicineCategory" AS ENUM ('ANTIBIOTIC', 'ANTIPARASITIC', 'VACCINE', 'VITAMIN', 'MINERAL', 'HORMONE', 'ANTI_INFLAMMATORY', 'ANALGESIC', 'OTHER');

-- CreateEnum
CREATE TYPE "MedicineStockMovementReason" AS ENUM ('PURCHASE', 'TREATMENT', 'ADJUSTMENT', 'EXPIRED_DISPOSED', 'CORRECTION');

-- CreateEnum
CREATE TYPE "ForageType" AS ENUM ('ROUGHAGE', 'CONCENTRATE', 'SILAGE', 'SUPPLEMENT', 'BY_PRODUCT', 'MINERAL', 'OTHER');

-- CreateEnum
CREATE TYPE "MilkTankType" AS ENUM ('SELLABLE', 'WITHHOLDING');

-- CreateEnum
CREATE TYPE "MilkTankActivity" AS ENUM ('COLLECTION', 'SALE', 'ADJUSTMENT', 'TRANSFER', 'CALF_ALLOCATION');

-- CreateTable
CREATE TABLE "Forage" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ForageType" NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "kgPerUnit" DOUBLE PRECISION,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerUnit" DOUBLE PRECISION NOT NULL,
    "lowStockThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "moisturePct" DOUBLE PRECISION,
    "supplier" TEXT,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Forage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medicine" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "type" "MedicineType" NOT NULL,
    "category" "MedicineCategory" NOT NULL,
    "manufacturer" TEXT,
    "batchId" TEXT,
    "unit" TEXT NOT NULL,
    "currentStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "costPerUnit" DOUBLE PRECISION NOT NULL,
    "lowStockThreshold" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchaseDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "milkWithdrawalDays" INTEGER NOT NULL DEFAULT 0,
    "meatWithdrawalDays" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Medicine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MedicineStockMovement" (
    "id" TEXT NOT NULL,
    "medicineId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "reason" "MedicineStockMovementReason" NOT NULL,
    "delta" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MedicineStockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkTank" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "tankType" "MilkTankType" NOT NULL,
    "totalCapacityL" DOUBLE PRECISION NOT NULL,
    "currentVolumeL" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fatPct" DOUBLE PRECISION,
    "proteinPct" DOUBLE PRECISION,
    "snfPct" DOUBLE PRECISION,
    "smartSensorId" TEXT,
    "targetTempC" DOUBLE PRECISION,
    "agitationIntervalMin" INTEGER,
    "assignedShedId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MilkTank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkTankAuditLog" (
    "id" TEXT NOT NULL,
    "milkTankId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "activityType" "MilkTankActivity" NOT NULL,
    "quantityL" DOUBLE PRECISION NOT NULL,
    "balanceAfterL" DOUBLE PRECISION NOT NULL,
    "source" TEXT,
    "notes" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkTankAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemenTank" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "modelManufacturer" TEXT,
    "strawCapacity" INTEGER NOT NULL,
    "numCanisters" INTEGER,
    "numCanes" INTEGER,
    "numGoblets" INTEGER,
    "storageLocation" TEXT,
    "currentTempC" DOUBLE PRECISION,
    "ln2LevelPct" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemenTank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemenBatch" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "batchCode" TEXT,
    "bullId" TEXT,
    "breed" TEXT,
    "strawColor" TEXT,
    "initialVitalityPct" DOUBLE PRECISION,
    "strawQuantity" INTEGER NOT NULL DEFAULT 0,
    "lowStrawThreshold" INTEGER NOT NULL DEFAULT 5,
    "fatherId" TEXT,
    "motherId" TEXT,
    "tankId" TEXT,
    "canister" TEXT,
    "cane" TEXT,
    "goblet" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemenBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Forage_farmId_idx" ON "Forage"("farmId");

-- CreateIndex
CREATE INDEX "Forage_type_idx" ON "Forage"("type");

-- CreateIndex
CREATE INDEX "Forage_createdBy_idx" ON "Forage"("createdBy");

-- CreateIndex
CREATE INDEX "Medicine_farmId_idx" ON "Medicine"("farmId");

-- CreateIndex
CREATE INDEX "Medicine_category_idx" ON "Medicine"("category");

-- CreateIndex
CREATE INDEX "Medicine_expiryDate_idx" ON "Medicine"("expiryDate");

-- CreateIndex
CREATE INDEX "Medicine_createdBy_idx" ON "Medicine"("createdBy");

-- CreateIndex
CREATE INDEX "MedicineStockMovement_medicineId_idx" ON "MedicineStockMovement"("medicineId");

-- CreateIndex
CREATE INDEX "MedicineStockMovement_farmId_idx" ON "MedicineStockMovement"("farmId");

-- CreateIndex
CREATE INDEX "MedicineStockMovement_createdAt_idx" ON "MedicineStockMovement"("createdAt");

-- CreateIndex
CREATE INDEX "MilkTank_farmId_idx" ON "MilkTank"("farmId");

-- CreateIndex
CREATE INDEX "MilkTank_tankType_idx" ON "MilkTank"("tankType");

-- CreateIndex
CREATE INDEX "MilkTank_createdBy_idx" ON "MilkTank"("createdBy");

-- CreateIndex
CREATE INDEX "MilkTankAuditLog_milkTankId_idx" ON "MilkTankAuditLog"("milkTankId");

-- CreateIndex
CREATE INDEX "MilkTankAuditLog_farmId_idx" ON "MilkTankAuditLog"("farmId");

-- CreateIndex
CREATE INDEX "MilkTankAuditLog_createdAt_idx" ON "MilkTankAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "SemenTank_farmId_idx" ON "SemenTank"("farmId");

-- CreateIndex
CREATE INDEX "SemenTank_createdBy_idx" ON "SemenTank"("createdBy");

-- CreateIndex
CREATE INDEX "SemenBatch_farmId_idx" ON "SemenBatch"("farmId");

-- CreateIndex
CREATE INDEX "SemenBatch_tankId_idx" ON "SemenBatch"("tankId");

-- CreateIndex
CREATE INDEX "SemenBatch_createdBy_idx" ON "SemenBatch"("createdBy");

-- AddForeignKey
ALTER TABLE "Forage" ADD CONSTRAINT "Forage_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Forage" ADD CONSTRAINT "Forage_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medicine" ADD CONSTRAINT "Medicine_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MedicineStockMovement" ADD CONSTRAINT "MedicineStockMovement_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkTank" ADD CONSTRAINT "MilkTank_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkTank" ADD CONSTRAINT "MilkTank_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkTankAuditLog" ADD CONSTRAINT "MilkTankAuditLog_milkTankId_fkey" FOREIGN KEY ("milkTankId") REFERENCES "MilkTank"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemenTank" ADD CONSTRAINT "SemenTank_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemenTank" ADD CONSTRAINT "SemenTank_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemenBatch" ADD CONSTRAINT "SemenBatch_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemenBatch" ADD CONSTRAINT "SemenBatch_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemenBatch" ADD CONSTRAINT "SemenBatch_tankId_fkey" FOREIGN KEY ("tankId") REFERENCES "SemenTank"("id") ON DELETE SET NULL ON UPDATE CASCADE;
