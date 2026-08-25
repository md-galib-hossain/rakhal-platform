-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED');

-- CreateEnum
CREATE TYPE "SaleLineType" AS ENUM ('MILK', 'ANIMAL', 'INVENTORY', 'MANURE');

-- CreateTable
CREATE TABLE "SaleLine" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "type" "SaleLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(18,2) NOT NULL,
    "unitId" TEXT,
    "unitPrice" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MilkSaleLine" (
    "id" TEXT NOT NULL,
    "saleLineId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MilkSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnimalSaleLine" (
    "id" TEXT NOT NULL,
    "saleLineId" TEXT NOT NULL,
    "cattleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnimalSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventorySaleLine" (
    "id" TEXT NOT NULL,
    "saleLineId" TEXT NOT NULL,
    "medicineId" TEXT,
    "feedItemId" TEXT,
    "equipmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventorySaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManureSaleLine" (
    "id" TEXT NOT NULL,
    "saleLineId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManureSaleLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "saleNumber" TEXT NOT NULL,
    "customerId" TEXT,
    "saleDate" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "SaleStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SaleLine_saleId_idx" ON "SaleLine"("saleId");

-- CreateIndex
CREATE INDEX "SaleLine_unitId_idx" ON "SaleLine"("unitId");

-- CreateIndex
CREATE INDEX "SaleLine_type_idx" ON "SaleLine"("type");

-- CreateIndex
CREATE UNIQUE INDEX "MilkSaleLine_saleLineId_key" ON "MilkSaleLine"("saleLineId");

-- CreateIndex
CREATE UNIQUE INDEX "AnimalSaleLine_saleLineId_key" ON "AnimalSaleLine"("saleLineId");

-- CreateIndex
CREATE INDEX "AnimalSaleLine_cattleId_idx" ON "AnimalSaleLine"("cattleId");

-- CreateIndex
CREATE UNIQUE INDEX "InventorySaleLine_saleLineId_key" ON "InventorySaleLine"("saleLineId");

-- CreateIndex
CREATE INDEX "InventorySaleLine_medicineId_idx" ON "InventorySaleLine"("medicineId");

-- CreateIndex
CREATE INDEX "InventorySaleLine_feedItemId_idx" ON "InventorySaleLine"("feedItemId");

-- CreateIndex
CREATE INDEX "InventorySaleLine_equipmentId_idx" ON "InventorySaleLine"("equipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "ManureSaleLine_saleLineId_key" ON "ManureSaleLine"("saleLineId");

-- CreateIndex
CREATE INDEX "Sale_farmId_idx" ON "Sale"("farmId");

-- CreateIndex
CREATE INDEX "Sale_farmId_saleDate_idx" ON "Sale"("farmId", "saleDate");

-- CreateIndex
CREATE INDEX "Sale_farmId_status_idx" ON "Sale"("farmId", "status");

-- CreateIndex
CREATE INDEX "Sale_farmId_customerId_idx" ON "Sale"("farmId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_farmId_saleNumber_key" ON "Sale"("farmId", "saleNumber");

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleLine" ADD CONSTRAINT "SaleLine_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MilkSaleLine" ADD CONSTRAINT "MilkSaleLine_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalSaleLine" ADD CONSTRAINT "AnimalSaleLine_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnimalSaleLine" ADD CONSTRAINT "AnimalSaleLine_cattleId_fkey" FOREIGN KEY ("cattleId") REFERENCES "Cattle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySaleLine" ADD CONSTRAINT "InventorySaleLine_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySaleLine" ADD CONSTRAINT "InventorySaleLine_medicineId_fkey" FOREIGN KEY ("medicineId") REFERENCES "Medicine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySaleLine" ADD CONSTRAINT "InventorySaleLine_feedItemId_fkey" FOREIGN KEY ("feedItemId") REFERENCES "Forage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventorySaleLine" ADD CONSTRAINT "InventorySaleLine_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManureSaleLine" ADD CONSTRAINT "ManureSaleLine_saleLineId_fkey" FOREIGN KEY ("saleLineId") REFERENCES "SaleLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
